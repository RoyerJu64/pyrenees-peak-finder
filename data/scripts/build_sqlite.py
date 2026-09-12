"""Assemble l'export OSM et l'enrichissement en une base SQLite embarquable.

Responsabilite unique : transformer data/raw/*.json en data/processed/peaks.sqlite.
Aucun acces reseau ; le script est rejouable hors ligne autant de fois qu'on veut.

Usage:
    python3 build_sqlite.py [--output CHEMIN]
"""

from __future__ import annotations

import argparse
import json
import re
import sqlite3
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from config import (
    ENRICHMENT_PATH,
    MAX_PLAUSIBLE_ALTITUDE,
    MIN_PLAUSIBLE_ALTITUDE,
    MVP_BBOX,
    RAW_PEAKS_PATH,
    SQLITE_PATH,
)

SCHEMA = """
PRAGMA journal_mode = DELETE;

CREATE TABLE peaks (
    id            TEXT    PRIMARY KEY,
    osm_id        INTEGER NOT NULL UNIQUE,
    name          TEXT    NOT NULL,
    latitude      REAL    NOT NULL,
    longitude     REAL    NOT NULL,
    altitude      REAL    NOT NULL,
    prominence    REAL,
    wikidata_id   TEXT,
    description   TEXT,
    wikipedia_url TEXT,
    -- Comment la description a ete rattachee au sommet ; NULL si pas de
    -- description. Conserve pour pouvoir auditer ou revoquer un appariement
    -- automatique sans rejouer tout le pipeline.
    match_method  TEXT
);

-- La requete de l'app est toujours un rectangle autour de l'utilisateur
-- (cf. boundingBoxAround dans @ppf/peak-geometry). L'index composite permet a
-- SQLite de restreindre sur la latitude puis de filtrer la longitude sans
-- parcourir la table.
CREATE INDEX idx_peaks_lat_lon ON peaks (latitude, longitude);

-- Tracabilite du jeu de donnees : sans elle, impossible de savoir quelle
-- extraction tourne sur le telephone d'un utilisateur.
CREATE TABLE dataset_metadata (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
"""

ELEVATION_PATTERN = re.compile(r"^\s*(-?\d+(?:[.,]\d+)?)\s*(m|metres|meters)?\s*$", re.IGNORECASE)


def parse_measurement(value: str | None) -> float | None:
    """Lit une altitude ou une proeminence OSM.

    Le tag `ele` est libre : on croise `2215`, `2215.0`, `2215 m`, `2215m`.
    Tout ce qui ne se reduit pas a un nombre est rejete plutot que devine.
    """
    if value is None:
        return None
    match = ELEVATION_PATTERN.match(value)
    if not match:
        return None
    try:
        return float(match.group(1).replace(",", "."))
    except ValueError:
        return None


def build_rows(
    elements: list[dict[str, Any]], enrichment: dict[str, Any]
) -> tuple[list[tuple[Any, ...]], dict[str, int]]:
    rows: list[tuple[Any, ...]] = []
    skipped = {
        "sans_nom": 0,
        "altitude_absente": 0,
        "altitude_illisible": 0,
        "altitude_invraisemblable": 0,
        "hors_emprise": 0,
    }

    for element in elements:
        tags = element.get("tags", {})
        name = (tags.get("name") or "").strip()
        if not name:
            skipped["sans_nom"] += 1
            continue

        raw_elevation = tags.get("ele")
        altitude = parse_measurement(raw_elevation)
        if altitude is None:
            # Sans altitude, pas d'angle d'elevation : le sommet est inutilisable
            # pour l'overlay, meme si son nom est connu.
            key = "altitude_absente" if raw_elevation is None else "altitude_illisible"
            skipped[key] += 1
            continue
        if not MIN_PLAUSIBLE_ALTITUDE <= altitude <= MAX_PLAUSIBLE_ALTITUDE:
            skipped["altitude_invraisemblable"] += 1
            continue

        latitude, longitude = element["lat"], element["lon"]
        if not MVP_BBOX.contains(latitude, longitude):
            skipped["hors_emprise"] += 1
            continue

        extra = enrichment.get(str(element["id"]), {})
        rows.append(
            (
                f"osm:node/{element['id']}",
                element["id"],
                name,
                latitude,
                longitude,
                altitude,
                parse_measurement(tags.get("prominence")),
                extra.get("wikidata_id") or tags.get("wikidata"),
                extra.get("description"),
                extra.get("wikipedia_url"),
                extra.get("match_method"),
            )
        )

    return rows, skipped


def write_database(rows: list[tuple[Any, ...]], metadata: dict[str, str], output: Path) -> None:
    output.parent.mkdir(parents=True, exist_ok=True)
    if output.exists():
        output.unlink()

    connection = sqlite3.connect(output)
    try:
        connection.executescript(SCHEMA)
        connection.executemany(
            "INSERT INTO peaks (id, osm_id, name, latitude, longitude, altitude,"
            " prominence, wikidata_id, description, wikipedia_url, match_method)"
            " VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            rows,
        )
        connection.executemany(
            "INSERT INTO dataset_metadata (key, value) VALUES (?, ?)",
            sorted(metadata.items()),
        )
        connection.commit()
        # Compacte le fichier : il part dans le bundle de l'app, chaque page
        # libre economisee est du telechargement en moins.
        connection.execute("VACUUM")
    finally:
        connection.close()


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--peaks", type=Path, default=RAW_PEAKS_PATH)
    parser.add_argument("--enrichment", type=Path, default=ENRICHMENT_PATH)
    parser.add_argument("--output", type=Path, default=SQLITE_PATH)
    args = parser.parse_args()

    if not args.peaks.exists():
        raise SystemExit(f"{args.peaks} absent : lancer d'abord fetch_osm_peaks.py")

    raw = json.loads(args.peaks.read_text(encoding="utf-8"))
    enrichment: dict[str, Any] = {}
    if args.enrichment.exists():
        enrichment = json.loads(args.enrichment.read_text(encoding="utf-8"))
    else:
        print(f"{args.enrichment} absent : base construite sans descriptions", file=sys.stderr)

    rows, skipped = build_rows(raw["elements"], enrichment)
    described = sum(1 for row in rows if row[8])

    metadata = {
        "built_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "osm_fetched_at": raw.get("fetched_at", "inconnu"),
        "bbox": MVP_BBOX.as_overpass(),
        "peak_count": str(len(rows)),
        "described_count": str(described),
        "schema_version": "1",
        "source": "OpenStreetMap (ODbL), Wikidata (CC0), Wikipedia (CC BY-SA)",
    }
    write_database(rows, metadata, args.output)

    size_kb = args.output.stat().st_size / 1024
    print(f"{len(rows)} sommets ecrits dans {args.output} ({size_kb:.0f} Kio)")
    print(f"  dont {described} avec description ({described / len(rows):.0%})")
    for reason, count in skipped.items():
        if count:
            print(f"  ecartes, {reason.replace('_', ' ')}: {count}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
