"""Associe a chaque sommet OSM une description issue de Wikidata / Wikipedia.

Responsabilite unique : produire data/raw/wikidata_enrichment.json, indexe par
identifiant de noeud OSM. N'ecrit pas en base, ne touche pas au brut OSM.

Trois chemins de resolution, du plus sur au moins sur, chacun trace dans le
champ `match_method` pour rester auditable :

  osm_wikidata_tag   le noeud OSM porte un tag `wikidata` -- lien pose par un
                     contributeur, sans ambiguite
  osm_wikipedia_tag  le noeud porte un tag `wikipedia` mais pas de `wikidata`
  spatial_name_match dernier recours : un element Wikidata de type montagne se
                     trouve a moins de 200 m ET porte le meme nom une fois
                     normalise. Les deux conditions sont exigees : Wikidata
                     classe en montagne des objets qui n'en sont pas, et les
                     Pyrenees alignent des sommets homonymes a quelques km.

Usage:
    python3 enrich_wikidata.py [--no-spatial-match] [--limit N]
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import time
import unicodedata
from math import asin, cos, radians, sin, sqrt
from pathlib import Path
from typing import Any, Iterable, Iterator

import requests

from config import ENRICHMENT_PATH, MVP_BBOX, RAW_PEAKS_PATH, USER_AGENT

WIKIDATA_API = "https://www.wikidata.org/w/api.php"
WIKIDATA_SPARQL = "https://query.wikidata.org/sparql"

# Ordre de preference : francais d'abord (public vise), puis les langues
# locales des deux versants, puis l'anglais en dernier recours.
LANGUAGE_PREFERENCE = ("fr", "es", "oc", "ca", "eu", "an", "en")
SITELINK_PREFERENCE = tuple(f"{lang}wiki" for lang in LANGUAGE_PREFERENCE)

SPATIAL_MATCH_RADIUS_M = 200.0

# Mots qui ne distinguent pas deux sommets l'un de l'autre.
GENERIC_TOKENS = frozenset(
    """
    pic pico puig punta pointe pena penya peak mont monte montagne montana
    sommet cime tuc turon turo soum cap serra sierra roc roca rocher
    le la les los las el l d de du des dels deth era eras i y et and of
    """.split()
)

SPARQL_MOUNTAINS = """
SELECT ?item ?itemLabel ?lat ?lon WHERE {{
  SERVICE wikibase:box {{
    ?item wdt:P625 ?coord .
    bd:serviceParam wikibase:cornerSouthWest "Point({west} {south})"^^geo:wktLiteral .
    bd:serviceParam wikibase:cornerNorthEast "Point({east} {north})"^^geo:wktLiteral .
  }}
  ?item wdt:P31/wdt:P279* wd:Q8502 .
  ?item p:P625/psv:P625 ?node .
  ?node wikibase:geoLatitude ?lat ; wikibase:geoLongitude ?lon .
  SERVICE wikibase:label {{ bd:serviceParam wikibase:language "fr,es,oc,ca,en". }}
}}
"""


def normalize_name(name: str) -> str:
    """Reduit un toponyme a ses mots distinctifs, sans accent ni article.

    "Pic du Midi d'Ossau" et "pic du Midi d'Ossau" donnent tous deux
    "midi ossau", ce qui rend la comparaison insensible a la casse, aux
    accents et aux variantes de generique.
    """
    decomposed = unicodedata.normalize("NFKD", name.lower())
    stripped = "".join(c for c in decomposed if not unicodedata.combining(c))
    tokens = [t for t in re.split(r"[^a-z0-9]+", stripped) if t]
    significant = [t for t in tokens if t not in GENERIC_TOKENS]
    # Un nom entierement generique ("Le Pic") ne peut pas servir de cle.
    return " ".join(sorted(significant)) if significant else ""


def haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r = 6_371_008.8
    dphi = radians(lat2 - lat1)
    dlambda = radians(lon2 - lon1)
    a = sin(dphi / 2) ** 2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlambda / 2) ** 2
    return 2 * r * asin(min(1.0, sqrt(a)))


def chunked(items: list[str], size: int) -> Iterator[list[str]]:
    for start in range(0, len(items), size):
        yield items[start : start + size]


def make_session() -> requests.Session:
    session = requests.Session()
    session.headers.update({"User-Agent": USER_AGENT, "Accept": "application/json"})
    return session


def parse_wikipedia_tag(tag: str) -> tuple[str, str] | None:
    """`fr:Pic du Midi d'Ossau` -> ('fr', "Pic du Midi d'Ossau")."""
    if ":" not in tag:
        return None
    lang, _, title = tag.partition(":")
    lang = lang.strip()
    title = title.strip()
    if not lang or not title or len(lang) > 5:
        return None
    return lang, title


def fetch_wikidata_entities(session: requests.Session, ids: list[str]) -> dict[str, Any]:
    """Descriptions et liens interwiki, par lots de 50 (limite de l'API)."""
    entities: dict[str, Any] = {}
    for batch in chunked(ids, 50):
        response = session.get(
            WIKIDATA_API,
            params={
                "action": "wbgetentities",
                "ids": "|".join(batch),
                "props": "descriptions|sitelinks|labels",
                "languages": "|".join(LANGUAGE_PREFERENCE),
                "sitefilter": "|".join(SITELINK_PREFERENCE),
                "format": "json",
            },
            timeout=60,
        )
        response.raise_for_status()
        entities.update(response.json().get("entities", {}))
        print(f"  wikidata: {len(entities)}/{len(ids)} entites", file=sys.stderr)
        time.sleep(0.2)
    return entities


def fetch_sparql_mountains(session: requests.Session) -> list[dict[str, Any]]:
    query = SPARQL_MOUNTAINS.format(
        west=MVP_BBOX.west, south=MVP_BBOX.south, east=MVP_BBOX.east, north=MVP_BBOX.north
    )
    response = session.get(
        WIKIDATA_SPARQL, params={"query": query, "format": "json"}, timeout=180
    )
    response.raise_for_status()
    seen: dict[str, dict[str, Any]] = {}
    for binding in response.json()["results"]["bindings"]:
        qid = binding["item"]["value"].rsplit("/", 1)[-1]
        if qid in seen:
            continue
        seen[qid] = {
            "id": qid,
            "label": binding["itemLabel"]["value"],
            "latitude": float(binding["lat"]["value"]),
            "longitude": float(binding["lon"]["value"]),
        }
    return list(seen.values())


def fetch_wikipedia_summary(session: requests.Session, lang: str, title: str) -> dict[str, Any] | None:
    """Resume REST d'un article : la premiere phrase y est deja degagee."""
    url = f"https://{lang}.wikipedia.org/api/rest_v1/page/summary/{requests.utils.quote(title, safe='')}"
    try:
        response = session.get(url, timeout=30)
        if response.status_code != 200:
            return None
        payload = response.json()
    except (requests.RequestException, ValueError):
        return None

    extract = (payload.get("extract") or "").strip()
    if not extract:
        return None
    return {
        "extract": extract,
        "url": payload.get("content_urls", {}).get("desktop", {}).get("page")
        or f"https://{lang}.wikipedia.org/wiki/{title.replace(' ', '_')}",
        "lang": lang,
    }


def pick_language(values: dict[str, Any], key: str = "value") -> str | None:
    for lang in LANGUAGE_PREFERENCE:
        entry = values.get(lang)
        if entry and entry.get(key):
            return entry[key]
    return None


def pick_sitelink(sitelinks: dict[str, Any]) -> tuple[str, str] | None:
    for site in SITELINK_PREFERENCE:
        entry = sitelinks.get(site)
        if entry and entry.get("title"):
            return site[:-4], entry["title"]
    return None


def shorten(text: str, max_chars: int = 400) -> str:
    """Coupe le resume a la fin d'une phrase, pas au milieu d'un mot.

    L'overlay affiche la description sous le nom du sommet : au-dela de deux ou
    trois phrases elle masque le paysage qu'elle est censee commenter.
    """
    if len(text) <= max_chars:
        return text
    window = text[: max_chars + 1]
    cut = max(window.rfind(". "), window.rfind(" ; "))
    if cut > max_chars // 2:
        return window[: cut + 1].strip()
    return window[:max_chars].rsplit(" ", 1)[0].rstrip(",;:") + "..."


def resolve_targets(
    peaks: list[dict[str, Any]], mountains: list[dict[str, Any]] | None
) -> dict[int, dict[str, Any]]:
    """Associe a chaque noeud OSM sa cible Wikidata/Wikipedia, si elle existe."""
    targets: dict[int, dict[str, Any]] = {}
    by_name: dict[str, list[dict[str, Any]]] = {}
    for mountain in mountains or []:
        key = normalize_name(mountain["label"])
        if key:
            by_name.setdefault(key, []).append(mountain)

    for peak in peaks:
        tags = peak.get("tags", {})
        name = tags.get("name")
        if not name:
            continue

        qid = tags.get("wikidata")
        if qid and re.fullmatch(r"Q\d+", qid):
            targets[peak["id"]] = {"wikidata_id": qid, "match_method": "osm_wikidata_tag"}
            continue

        wikipedia = parse_wikipedia_tag(tags.get("wikipedia", ""))
        if wikipedia:
            lang, title = wikipedia
            targets[peak["id"]] = {
                "wikidata_id": None,
                "wikipedia": {"lang": lang, "title": title},
                "match_method": "osm_wikipedia_tag",
            }
            continue

        candidates = by_name.get(normalize_name(name), [])
        near = [
            (haversine(peak["lat"], peak["lon"], c["latitude"], c["longitude"]), c)
            for c in candidates
        ]
        near = [(d, c) for d, c in near if d <= SPATIAL_MATCH_RADIUS_M]
        # Deux candidats homonymes dans le rayon : on ne devine pas, on renonce.
        if len(near) == 1:
            distance, candidate = near[0]
            targets[peak["id"]] = {
                "wikidata_id": candidate["id"],
                "match_method": "spatial_name_match",
                "match_distance_m": round(distance, 1),
            }

    return targets


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, default=RAW_PEAKS_PATH)
    parser.add_argument("--output", type=Path, default=ENRICHMENT_PATH)
    parser.add_argument(
        "--no-spatial-match",
        action="store_true",
        help="n'utiliser que les liens poses explicitement dans OSM",
    )
    parser.add_argument("--limit", type=int, default=None, help="pour une execution d'essai")
    args = parser.parse_args()

    if not args.input.exists():
        raise SystemExit(f"{args.input} absent : lancer d'abord fetch_osm_peaks.py")

    peaks = json.loads(args.input.read_text(encoding="utf-8"))["elements"]
    if args.limit:
        peaks = peaks[: args.limit]

    session = make_session()

    mountains = None
    if not args.no_spatial_match:
        print("Requete SPARQL des montagnes Wikidata de l'emprise ...", file=sys.stderr)
        mountains = fetch_sparql_mountains(session)
        print(f"  {len(mountains)} elements", file=sys.stderr)

    targets = resolve_targets(peaks, mountains)
    print(f"{len(targets)} sommets rattaches a une source", file=sys.stderr)

    qids = sorted({t["wikidata_id"] for t in targets.values() if t.get("wikidata_id")})
    entities = fetch_wikidata_entities(session, qids) if qids else {}

    # Un meme article peut etre vise par plusieurs sommets : on ne le telecharge
    # qu'une fois.
    summaries: dict[tuple[str, str], dict[str, Any] | None] = {}

    enrichment: dict[str, Any] = {}
    for osm_id, target in sorted(targets.items()):
        qid = target.get("wikidata_id")
        entity = entities.get(qid, {}) if qid else {}

        wikidata_description = pick_language(entity.get("descriptions", {}))
        article = target.get("wikipedia") or None
        if article is None:
            sitelink = pick_sitelink(entity.get("sitelinks", {}))
            if sitelink:
                article = {"lang": sitelink[0], "title": sitelink[1]}

        summary = None
        if article:
            key = (article["lang"], article["title"])
            if key not in summaries:
                summaries[key] = fetch_wikipedia_summary(session, *key)
                time.sleep(0.1)
            summary = summaries[key]

        description = shorten(summary["extract"]) if summary else wikidata_description
        if not description:
            continue

        enrichment[str(osm_id)] = {
            "wikidata_id": qid,
            "description": description,
            "description_source": "wikipedia" if summary else "wikidata",
            "wikipedia_url": summary["url"] if summary else None,
            "match_method": target["match_method"],
            **({"match_distance_m": target["match_distance_m"]} if "match_distance_m" in target else {}),
        }
        if len(enrichment) % 25 == 0:
            print(f"  {len(enrichment)} descriptions collectees", file=sys.stderr)

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(
        json.dumps(enrichment, ensure_ascii=False, indent=2, sort_keys=True), encoding="utf-8"
    )

    by_method: dict[str, int] = {}
    for entry in enrichment.values():
        by_method[entry["match_method"]] = by_method.get(entry["match_method"], 0) + 1

    print(f"\n{len(enrichment)} descriptions ecrites dans {args.output}")
    for method, count in sorted(by_method.items(), key=lambda kv: -kv[1]):
        print(f"  {method:20s} {count}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
