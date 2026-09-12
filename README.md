# Pyrenees Peak Finder

Vise un sommet avec la camera du telephone, obtiens son nom, son altitude et une
breve description. Vallees d'Ossau et d'Aspe pour commencer, chaine entiere
ensuite.

L'identification est geometrique, pas visuelle : position GPS, cap de la
boussole, inclinaison et une base de sommets embarquee suffisent a savoir ce qui
se trouve dans le champ. L'application ne lit pas l'image de la camera, elle
calcule ou tomber les etiquettes. Voir [docs/architecture.md](docs/architecture.md).

## Etat

| | |
|---|---|
| Phase 0 — scaffold monorepo | fait |
| Phase 1 — dataset Ossau + Aspe | fait, 1263 sommets, 240 Kio |
| Phase 2 — MVP camera | geometrie faite et testee, app a ecrire |
| Phase 3 — occlusion MNT | partiel : occlusion entre sommets faite, MNT a venir |
| Phases 3 a 6 | a venir |

Detail dans [docs/roadmap.md](docs/roadmap.md).

## Prise en main

```bash
corepack enable            # pnpm 9
pnpm install
pnpm test                  # 112 tests unitaires de geometrie
pnpm typecheck
```

Le pipeline de donnees est independant de l'application :

```bash
pip install -r data/scripts/requirements.txt
python3 data/scripts/fetch_osm_peaks.py      # Overpass -> data/raw/
python3 data/scripts/enrich_wikidata.py      # Wikidata / Wikipedia
python3 data/scripts/build_sqlite.py         # -> data/processed/peaks.sqlite
python3 data/scripts/validate_dataset.py     # code de sortie 1 si echec
```

La base versionnee est deja a jour : ces commandes ne servent qu'a la
regenerer ou a elargir l'emprise.

## Organisation

```
packages/shared-types     types et unites, partages par tout le monorepo
packages/peak-geometry    distance, gisement, elevation, visibilite, FOV,
                          pertinence, projection, etiquettes
apps/mobile               application Expo (a venir)
data/scripts              pipeline Python
docs                      architecture, sources de donnees, roadmap
```

Une donnee va dans un seul endroit. La geometrie vit dans `peak-geometry`,
jamais dupliquee dans l'application.

## Attributions

Sommets : [OpenStreetMap](https://www.openstreetmap.org/copyright) (ODbL).
Descriptions : [Wikidata](https://www.wikidata.org) (CC0) et
[Wikipedia](https://fr.wikipedia.org) (CC BY-SA).
