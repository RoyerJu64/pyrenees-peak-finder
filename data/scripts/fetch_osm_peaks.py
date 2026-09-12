"""Recupere les sommets OpenStreetMap de la zone MVP via l'API Overpass.

Responsabilite unique : interroger Overpass et deposer la reponse brute dans
data/raw/. Aucun nettoyage, aucun enrichissement, aucune ecriture en base ;
garder l'export brut permet de rejouer les etapes suivantes sans redemander
quoi que ce soit au serveur.

Usage:
    python3 fetch_osm_peaks.py [--output CHEMIN] [--timeout SECONDES]
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import requests

from config import MVP_BBOX, RAW_PEAKS_PATH, USER_AGENT, BoundingBox

OVERPASS_ENDPOINTS = (
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
)


def build_query(bbox: BoundingBox, timeout: int) -> str:
    """Requete Overpass QL : les noeuds `natural=peak` de l'emprise.

    Les sommets sont modelises en noeuds dans OSM ; interroger aussi les ways
    et relations ne ramenerait que du bruit (cretes, zones).
    """
    return f"""
[out:json][timeout:{timeout}];
node["natural"="peak"]({bbox.as_overpass()});
out body;
""".strip()


def fetch(query: str, timeout: int) -> dict[str, Any]:
    """Interroge Overpass, en basculant sur un miroir si le premier flanche."""
    errors: list[str] = []
    for endpoint in OVERPASS_ENDPOINTS:
        try:
            print(f"Interrogation de {endpoint} ...", file=sys.stderr)
            response = requests.post(
                endpoint,
                data={"data": query},
                headers={"User-Agent": USER_AGENT},
                timeout=timeout + 30,
            )
            response.raise_for_status()
            return response.json()
        except (requests.RequestException, ValueError) as exc:
            errors.append(f"{endpoint}: {exc}")
            print(f"  echec ({exc})", file=sys.stderr)

    raise SystemExit("Aucun miroir Overpass n'a repondu :\n  " + "\n  ".join(errors))


def write_output(payload: dict[str, Any], bbox: BoundingBox, query: str, output: Path) -> int:
    elements = payload.get("elements", [])
    document = {
        "fetched_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "bbox": bbox._asdict(),
        "query": query,
        "element_count": len(elements),
        "elements": elements,
    }
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(document, ensure_ascii=False, indent=2), encoding="utf-8")
    return len(elements)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=RAW_PEAKS_PATH)
    parser.add_argument("--timeout", type=int, default=180)
    args = parser.parse_args()

    query = build_query(MVP_BBOX, args.timeout)
    payload = fetch(query, args.timeout)
    count = write_output(payload, MVP_BBOX, query, args.output)

    named = sum(1 for e in payload.get("elements", []) if e.get("tags", {}).get("name"))
    print(f"{count} noeuds natural=peak ecrits dans {args.output}")
    print(f"  dont {named} portant un nom")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
