"""Parametres partages par les scripts du pipeline de donnees.

Un seul endroit definit la zone couverte et les chemins : les scripts fetch /
enrich / build / validate doivent s'accorder sur la meme emprise, sans quoi la
validation rejetterait ce que la collecte a produit.
"""

from __future__ import annotations

from pathlib import Path
from typing import NamedTuple

DATA_DIR = Path(__file__).resolve().parent.parent
RAW_DIR = DATA_DIR / "raw"
PROCESSED_DIR = DATA_DIR / "processed"

RAW_PEAKS_PATH = RAW_DIR / "osm_peaks.json"
ENRICHMENT_PATH = RAW_DIR / "wikidata_enrichment.json"
SQLITE_PATH = PROCESSED_DIR / "peaks.sqlite"

USER_AGENT = (
    "PyreneesPeakFinder/0.1 (projet personnel, identification de sommets; "
    "https://github.com/julien-royer/pyrenees-peak-finder)"
)


class BoundingBox(NamedTuple):
    """Emprise geographique, en degres decimaux WGS84."""

    south: float
    west: float
    north: float
    east: float

    def contains(self, latitude: float, longitude: float) -> bool:
        return (
            self.south <= latitude <= self.north
            and self.west <= longitude <= self.east
        )

    def as_overpass(self) -> str:
        return f"{self.south},{self.west},{self.north},{self.east}"


# Vallees d'Ossau et d'Aspe, elargies au versant espagnol et aux massifs
# limitrophes : depuis une vallee pyreneenne on voit largement au-dela de son
# bassin versant, et un sommet visible mais absent de la base est un trou
# fonctionnel, pas une economie.
#
# Couvre a l'ouest le Pic d'Anie (-0.68), a l'est le Balaitous (-0.29),
# au sud la sierra de Tendenera et Sallent de Gallego, au nord le piemont.
MVP_BBOX = BoundingBox(south=42.65, west=-0.95, north=43.25, east=-0.15)

# Altitudes plausibles pour la chaine : le Pic d'Aneto culmine a 3404 m.
MIN_PLAUSIBLE_ALTITUDE = 200.0
MAX_PLAUSIBLE_ALTITUDE = 3500.0
