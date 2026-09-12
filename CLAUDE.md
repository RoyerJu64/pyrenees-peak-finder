# CLAUDE.md — Pyrenees Peak Finder

Ce fichier définit les conventions du projet. Le lire avant toute intervention et s'y tenir pour garder une cohérence entre les sessions.

## Objectif du projet

Application mobile qui identifie les sommets pyrénéens visés par la caméra du téléphone. L'utilisateur ouvre l'app, vise un sommet, et obtient : nom, altitude, brève description.

Zone cible MVP : vallées d'Ossau et d'Aspe. Extension prévue à l'ensemble de la chaîne pyrénéenne en phase ultérieure.

## Principe technique (important — ne pas dévier sans discussion explicite)

L'identification **n'est pas un problème de classification d'images**. C'est un problème géométrique :

1. Position GPS du téléphone (lat, lon, altitude)
2. Orientation du téléphone (cap boussole + inclinaison) via magnétomètre/accéléromètre
3. Base de données de sommets (nom, lat, lon, altitude, description)
4. Calcul du gisement et de l'angle d'élévation vers chaque sommet, comparé au champ de vision de la caméra
5. Filtrage par visibilité (occlusion) via un modèle numérique de terrain (MNT), pour ne pas afficher un pic caché derrière une crête plus proche

Un raffinement par vision (extraction de ligne de crête + matching contre un panorama MNT synthétique, pour corriger la dérive du magnétomètre) est une extension de phase avancée, pas un prérequis du MVP.

## Stack technique figée

| Composant | Choix |
|---|---|
| App mobile | React Native + Expo (expo-camera, expo-location, expo-sensors) |
| Données pics | SQLite/GeoJSON embarqué dans l'app (fonctionnement hors-ligne) |
| Pipeline de données | Scripts Python indépendants de l'app |
| Source des pics | OpenStreetMap (Overpass API, tag `natural=peak`), enrichi via Wikidata/Wikipedia pour les descriptions |
| MNT (visibilité) | Copernicus GLO-30 (30m, mondial, gratuit) — migration possible vers IGN RGE ALTI (5m, France) si besoin de précision accrue |
| Backend | Aucun pour le MVP. FastAPI envisageable en phase 4+ si le dataset complet ne tient plus embarqué |
| Monorepo | pnpm workspaces |

Ne pas changer un de ces choix sans le signaler explicitement — ce sont des décisions d'architecture, pas des détails d'implémentation.

## Structure du répertoire

```
pyrenees-peak-finder/
├── CLAUDE.md
├── README.md
├── docs/
│   ├── architecture.md
│   ├── data-sources.md
│   └── roadmap.md
├── data/
│   ├── raw/                       # exports Overpass bruts
│   ├── processed/                 # peaks.sqlite final, versionné
│   └── scripts/
│       ├── fetch_osm_peaks.py
│       ├── enrich_wikidata.py
│       ├── build_dem_cache.py
│       └── validate_dataset.py
├── packages/
│   ├── peak-geometry/              # bearing, distance, FOV, visibilité — testé unitairement
│   │   ├── src/
│   │   └── tests/
│   └── shared-types/
├── apps/
│   └── mobile/                     # app Expo/React Native
│       ├── app/                    # écrans (expo-router)
│       ├── src/
│       │   ├── camera/
│       │   ├── sensors/
│       │   ├── overlay/
│       │   ├── peaks/              # requêtes spatiales locales
│       │   └── ui/
│       └── assets/peaks.sqlite
├── ml/                              # phase avancée, skyline matching
│   ├── notebooks/
│   └── models/
└── .github/workflows/
```

Une donnée va dans un seul endroit : la logique géométrique dans `packages/peak-geometry`, jamais dupliquée dans `apps/mobile`. L'app mobile consomme le package, ne réimplémente rien.

## Algorithme cœur — référence

Pour chaque sommet candidat dans un rayon donné (index spatial, pas de boucle sur toute la base) :

1. `bearing(user, peak)` — gisement, formule de navigation sphérique
2. `elevationAngle(user, peak)` = `atan2(altitude_peak - altitude_user, distance_horizontale)`, corrigé de la courbure terrestre + réfraction atmosphérique au-delà de quelques km
3. Test d'appartenance au champ de vision caméra (FOV horizontal/vertical du device)
4. Test de visibilité : ray-marching le long du gisement à travers le MNT — rejeter si un relief plus proche masque le sommet
5. Projection écran : écart angulaire → position pixel, avec anti-collision des labels qui se chevauchent

## Conventions de code

- TypeScript strict pour `packages/` et `apps/mobile`
- Toute fonction géométrique dans `peak-geometry` doit avoir un test unitaire avant d'être branchée à l'UI
- Python : type hints, un script = une responsabilité (fetch / enrich / build / validate, pas de script fourre-tout)
- Pas d'emoji dans le code ou l'UI — utiliser une librairie d'icônes cohérente (ex. lucide) si besoin d'iconographie
- Design minimaliste, typographie soignée — éviter les patterns UI génériques

## Ordre de travail attendu

1. Dataset (Ossau + Aspe) avant tout code applicatif
2. Logique géométrique testée (`peak-geometry`) avant l'écran caméra
3. Overlay géométrique simple (sans occlusion) avant d'ajouter le test de visibilité MNT
4. Ne pas commencer la phase vision (`ml/`) avant que le pipeline géométrique soit stable et testé sur le terrain

## Roadmap

- [x] Phase 0 — Setup repo, scaffold monorepo
- [x] Phase 1 — Dataset Ossau + Aspe (Overpass → SQLite, enrichi Wikidata)
- [ ] Phase 2 — MVP : caméra + GPS + boussole + overlay géométrique simple — `peak-geometry` fait et testé, `apps/mobile` à écrire
- [ ] Phase 3 — Test de visibilité (occlusion) via MNT
- [ ] Phase 4 — Extension à toute la chaîne pyrénéenne, optimisation perf
- [ ] Phase 5 — Raffinement vision (skyline matching contre panorama MNT synthétique)
- [ ] Phase 6 — Polish UI, mode offline complet, export photo annotée
