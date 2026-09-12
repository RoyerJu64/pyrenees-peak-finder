"""Controle la base peaks.sqlite avant qu'elle parte dans le bundle de l'app.

Responsabilite unique : verifier, ne rien reparer. Sort en code 1 si un controle
bloquant echoue, de sorte que la CI puisse refuser un dataset abime. Les
avertissements n'echouent pas : ils signalent une qualite de donnee a surveiller,
pas une base inutilisable.

Usage:
    python3 validate_dataset.py [--database CHEMIN] [--strict]
"""

from __future__ import annotations

import argparse
import sqlite3
import sys
import unicodedata
from math import asin, cos, radians, sin, sqrt
from pathlib import Path

from config import (
    MAX_PLAUSIBLE_ALTITUDE,
    MIN_PLAUSIBLE_ALTITUDE,
    MVP_BBOX,
    SQLITE_PATH,
)

# Sommets de reference des vallees d'Ossau et d'Aspe : leur absence, ou une
# altitude qui derive, revele une extraction tronquee ou une emprise fautive.
#
# La recherche porte sur un fragment de nom, pas sur l'egalite : OSM nomme le
# pic de Sesques "L'Escarpu ou Pic de Sesques" et le pic d'Aspe "Pico de Aspe".
# Les altitudes attendues sont les valeurs publiees (IGN / Wikipedia), pas
# celles relevees dans la base -- sans quoi le controle se validerait lui-meme.
# Tolerance de 15 m : OSM et l'IGN ne s'accordent pas toujours au metre pres.
REFERENCE_PEAKS = (
    ("midi d'ossau", 2884.0),
    ("anie", 2504.0),
    ("balaitous", 3144.0),
    ("sesques", 2606.0),
    ("aspe", 2640.0),
)
REFERENCE_ALTITUDE_TOLERANCE_M = 15.0

DUPLICATE_RADIUS_M = 150.0


class Report:
    def __init__(self) -> None:
        self.errors: list[str] = []
        self.warnings: list[str] = []
        self.notes: list[str] = []

    def error(self, message: str) -> None:
        self.errors.append(message)

    def warn(self, message: str) -> None:
        self.warnings.append(message)

    def note(self, message: str) -> None:
        self.notes.append(message)


def haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r = 6_371_008.8
    a = (
        sin(radians(lat2 - lat1) / 2) ** 2
        + cos(radians(lat1)) * cos(radians(lat2)) * sin(radians(lon2 - lon1) / 2) ** 2
    )
    return 2 * r * asin(min(1.0, sqrt(a)))


def check_schema(connection: sqlite3.Connection, report: Report) -> None:
    tables = {row[0] for row in connection.execute("SELECT name FROM sqlite_master WHERE type = 'table'")}
    for table in ("peaks", "dataset_metadata"):
        if table not in tables:
            report.error(f"table manquante : {table}")

    indexes = {row[0] for row in connection.execute("SELECT name FROM sqlite_master WHERE type = 'index'")}
    if "idx_peaks_lat_lon" not in indexes:
        report.error("index spatial idx_peaks_lat_lon manquant : les requetes de l'app scanneraient la table")


def check_integrity(connection: sqlite3.Connection, report: Report) -> None:
    result = connection.execute("PRAGMA integrity_check").fetchone()
    if result is None or result[0] != "ok":
        report.error(f"integrity_check SQLite : {result}")


def check_rows(connection: sqlite3.Connection, report: Report) -> int:
    total = connection.execute("SELECT COUNT(*) FROM peaks").fetchone()[0]
    if total == 0:
        report.error("base vide")
        return 0
    report.note(f"{total} sommets")

    empty_names = connection.execute(
        "SELECT COUNT(*) FROM peaks WHERE name IS NULL OR TRIM(name) = ''"
    ).fetchone()[0]
    if empty_names:
        report.error(f"{empty_names} sommets sans nom")

    bad_altitude = connection.execute(
        "SELECT COUNT(*) FROM peaks WHERE altitude < ? OR altitude > ?",
        (MIN_PLAUSIBLE_ALTITUDE, MAX_PLAUSIBLE_ALTITUDE),
    ).fetchone()[0]
    if bad_altitude:
        report.error(f"{bad_altitude} altitudes hors de [{MIN_PLAUSIBLE_ALTITUDE}, {MAX_PLAUSIBLE_ALTITUDE}] m")

    outside = connection.execute(
        "SELECT COUNT(*) FROM peaks WHERE latitude < ? OR latitude > ? OR longitude < ? OR longitude > ?",
        (MVP_BBOX.south, MVP_BBOX.north, MVP_BBOX.west, MVP_BBOX.east),
    ).fetchone()[0]
    if outside:
        report.error(f"{outside} sommets hors de l'emprise declaree")

    malformed_ids = connection.execute(
        "SELECT COUNT(*) FROM peaks WHERE id NOT LIKE 'osm:node/%'"
    ).fetchone()[0]
    if malformed_ids:
        report.error(f"{malformed_ids} identifiants ne suivent pas la forme osm:node/<id>")

    orphan_urls = connection.execute(
        "SELECT COUNT(*) FROM peaks WHERE wikipedia_url IS NOT NULL AND description IS NULL"
    ).fetchone()[0]
    if orphan_urls:
        report.error(f"{orphan_urls} sommets ont une URL Wikipedia sans description")

    return total


def _strip_accents(text: str) -> str:
    decomposed = unicodedata.normalize("NFKD", text.lower())
    return "".join(c for c in decomposed if not unicodedata.combining(c))


def check_reference_peaks(connection: sqlite3.Connection, report: Report) -> None:
    rows = [
        (name, altitude, _strip_accents(name))
        for name, altitude in connection.execute("SELECT name, altitude FROM peaks")
    ]

    for fragment, expected in REFERENCE_PEAKS:
        candidates = [
            (name, altitude)
            for name, altitude, normalized in rows
            if fragment in normalized
            and abs(altitude - expected) <= REFERENCE_ALTITUDE_TOLERANCE_M
        ]
        if not candidates:
            near = [
                f"{name} ({altitude:.0f} m)"
                for name, altitude, normalized in rows
                if fragment in normalized
            ]
            detail = f" ; candidats homonymes : {', '.join(near[:3])}" if near else ""
            report.error(
                f"aucun sommet contenant \"{fragment}\" a {expected:.0f} m "
                f"(+/- {REFERENCE_ALTITUDE_TOLERANCE_M:.0f} m){detail}"
            )


def check_duplicates(connection: sqlite3.Connection, report: Report) -> None:
    """Repere les doublons OSM : meme nom, a moins de 150 m l'un de l'autre.

    Deux noeuds pour un seul sommet produiraient deux etiquettes superposees
    dans l'overlay. Les homonymes eloignes, eux, sont legion dans les Pyrenees
    et parfaitement legitimes.
    """
    rows = connection.execute("SELECT name, latitude, longitude FROM peaks ORDER BY name").fetchall()
    by_name: dict[str, list[tuple[float, float]]] = {}
    for name, latitude, longitude in rows:
        by_name.setdefault(name, []).append((latitude, longitude))

    duplicates: list[str] = []
    for name, positions in by_name.items():
        for i in range(len(positions)):
            for j in range(i + 1, len(positions)):
                if haversine(*positions[i], *positions[j]) < DUPLICATE_RADIUS_M:
                    duplicates.append(name)
                    break

    if duplicates:
        report.warn(
            f"{len(duplicates)} doublons probables (meme nom a moins de {DUPLICATE_RADIUS_M:.0f} m) : "
            + ", ".join(sorted(set(duplicates))[:5])
            + ("..." if len(duplicates) > 5 else "")
        )


def check_coverage(connection: sqlite3.Connection, total: int, report: Report) -> None:
    described = connection.execute(
        "SELECT COUNT(*) FROM peaks WHERE description IS NOT NULL"
    ).fetchone()[0]
    report.note(f"{described} sommets decrits ({described / total:.0%})")

    # Les sommets notables sans description sont ceux qu'on verra le plus :
    # c'est la ou une lacune se remarque.
    missing_notable = connection.execute(
        "SELECT COUNT(*) FROM peaks WHERE description IS NULL AND altitude >= 2500"
    ).fetchone()[0]
    if missing_notable:
        report.warn(f"{missing_notable} sommets au-dessus de 2500 m sans description")

    automatic = connection.execute(
        "SELECT COUNT(*) FROM peaks WHERE match_method = 'spatial_name_match'"
    ).fetchone()[0]
    if automatic:
        report.note(f"{automatic} descriptions rattachees par appariement spatial (a relire)")


def check_metadata(connection: sqlite3.Connection, report: Report) -> None:
    metadata = dict(connection.execute("SELECT key, value FROM dataset_metadata"))
    for key in ("built_at", "bbox", "peak_count", "schema_version", "source"):
        if key not in metadata:
            report.error(f"metadonnee manquante : {key}")

    declared = metadata.get("peak_count")
    actual = connection.execute("SELECT COUNT(*) FROM peaks").fetchone()[0]
    if declared is not None and int(declared) != actual:
        report.error(f"peak_count annonce {declared}, table en contient {actual}")

    if metadata.get("bbox") and metadata["bbox"] != MVP_BBOX.as_overpass():
        report.warn(f"base construite sur l'emprise {metadata['bbox']}, config.py declare {MVP_BBOX.as_overpass()}")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--database", type=Path, default=SQLITE_PATH)
    parser.add_argument("--strict", action="store_true", help="echouer aussi sur les avertissements")
    args = parser.parse_args()

    if not args.database.exists():
        raise SystemExit(f"{args.database} absent : lancer d'abord build_sqlite.py")

    report = Report()
    connection = sqlite3.connect(f"file:{args.database}?mode=ro", uri=True)
    try:
        check_schema(connection, report)
        check_integrity(connection, report)
        total = check_rows(connection, report)
        if total:
            check_reference_peaks(connection, report)
            check_duplicates(connection, report)
            check_coverage(connection, total, report)
            check_metadata(connection, report)
    finally:
        connection.close()

    for note in report.notes:
        print(f"  {note}")
    for warning in report.warnings:
        print(f"AVERTISSEMENT  {warning}", file=sys.stderr)
    for error in report.errors:
        print(f"ERREUR         {error}", file=sys.stderr)

    if report.errors:
        print(f"\n{len(report.errors)} controle(s) en echec", file=sys.stderr)
        return 1
    if report.warnings and args.strict:
        print(f"\n{len(report.warnings)} avertissement(s), mode strict", file=sys.stderr)
        return 1

    print(f"\nDataset valide ({len(report.warnings)} avertissement(s))")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
