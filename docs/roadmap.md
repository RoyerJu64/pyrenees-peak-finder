# Roadmap

Etat au 12 septembre 2026.

## Phase 0 — Setup repo, scaffold monorepo — fait

Monorepo pnpm, TypeScript strict, deux packages, CI GitHub Actions.

## Phase 1 — Dataset Ossau + Aspe — fait

Pipeline Overpass -> Wikidata -> SQLite -> validation. 1263 sommets, 240 Kio,
120 descriptions. Detail dans [data-sources.md](data-sources.md).

Reste ouvert : 205 sommets au-dessus de 2500 m sans description. Combler ce
manque demande une redaction manuelle ou une autre source, pas un reglage de
script.

## Phase 2 — MVP camera + GPS + boussole + overlay — eprouve sur le terrain

Fait : la geometrie complete, testee (125 tests unitaires).

- `boundingBoxAround` — prefiltre spatial de la requete SQL
- `computeSighting` — distance, gisement, elevation corrigee
- `markPeakOcclusion` — occlusion entre sommets, sans MNT
- `compareByRelevance` — visibilite, puis description, puis taille apparente
- `cameraFieldOfView` — FOV rendu, deduit de l'EXIF, rognage et orientation compris
- `projectSighting` — projection stenope, roulis compris
- `orientationFromDeviceRotation` — attitude du telephone vers axe optique
- `layoutLabels` — anti-collision des etiquettes

Ecrit, cote `apps/mobile` (Expo SDK 57, expo-router) :

- [x] scaffold Expo en monorepo pnpm — bundle Metro verifie en CI
- [x] `peaks.sqlite` embarque, recopie depuis `data/processed` au demarrage
- [x] requete spatiale locale alimentee par `boundingBoxAround`
- [x] `expo-location` — position, altitude, permissions
- [x] `expo-sensors` — attitude vers cap/inclinaison/roulis, lissage exponentiel
- [x] FOV mesure par l'EXIF d'une prise de vue silencieuse, conserve d'un
      lancement a l'autre
- [x] overlay : etiquettes, filets de rappel, anti-collision
- [x] fiche sommet et ruban de cap avec recalage manuel

**Test de terrain depuis Pau, septembre 2026 : la chaine de calcul est juste.**
Position, cap, inclinaison, projection — les sommets tombent au bon endroit.
Les deux incertitudes ouvertes sont levees : `DeviceMotion.rotation` est bien
en radians, et le referentiel de cap est exploitable.

Ce que le test a revele, en revanche :

- **Les etiquettes partaient dans le ciel.** Depuis la plaine, la chaine tient
  dans une bande de 31 px et l'anti-collision les empilait jusqu'a 334 px
  au-dessus de leur sommet. Corrige par `maxRise`.
- **Aucun critere de distinction visuelle.** 131 des 137 sommets projetes
  etaient des bosses anonymes indiscernables a 40 km. Corrige par
  `selectSkylinePeaks`.
- **Le rayon de 45 km ecartait le Pic du Midi d'Ossau depuis Pau** (50.4 km),
  soit precisement le sommet qu'on y cherche. Porte a 80 km.

Depuis Pau, cap 180 : 6 etiquettes au lieu de 12 empilees, Ossau, Ger, Gabizos
et Moun Ne compris. Depuis Laruns : 9.

Les deux points ouverts ont ete tranches.

**Le FOV** se lit dans l'EXIF (`FocalLengthIn35mmFilm`), pas dans une table
d'appareils. Voir [architecture.md](architecture.md#champ-de-vision).

**Le tri** se fait sur visibilite, puis description, puis taille apparente.
Mesure sur le dataset reel, depuis Laruns, cap 184, champ rendu 34.2 x 67.3 :

| | avant | apres |
|---|---|---|
| sommets dans 40 km | 1158 | 1158 |
| ecartes comme caches | 0 | 770 |
| dans le champ | 371 | 54 |
| etiquettes placees | 35 | 25 |
| rang du Pic du Midi d'Ossau | evince | 1er |

Reste un encombrement propre au massif de l'Ossau : Pointe de France, Petit Pic
du Midi, Pointe d'Aragon, Doigt de Pompie sont des satellites du meme sommet et
occupent quatre etiquettes cote a cote. Un regroupement par massif, ou
l'occlusion MNT, reglera la question.

## Phase 3 — Occlusion via MNT

Le test de terrain a precise ce qu'il en reste a faire. Depuis Pau, l'occlusion
entre sommets n'ecarte que 126 candidats sur 413 : ce qui masque l'horizon
depuis la plaine, c'est le piemont, et le piemont n'a pas de sommet reference.
C'est exactement le trou que le MNT comble.

- [ ] `build_dem_cache.py` — tuiles Copernicus GLO-30 sur l'emprise
- [ ] format embarquable : le MNT brut de l'emprise pese bien plus que la base
      de sommets, un decoupage ou une reduction sera necessaire
- [ ] `visibility.ts` dans `peak-geometry` — ray-marching le long du gisement,
      interface d'echantillonnage d'altitude injectable pour rester testable
- [ ] bascule du champ `visibility` de `unknown` a `visible` / `occluded`

A ne pas commencer avant que l'overlay simple ait ete verifie sur le terrain :
sans cette verification, une etiquette mal placee sera imputee a l'occlusion
alors qu'elle viendra du cap.

## Phase 4 — Chaine pyreneenne entiere

- [ ] elargir `MVP_BBOX` a toute la chaine
- [ ] mesurer : taille de la base, temps de requete, budget memoire
- [ ] le B-tree composite suffira-t-il a ~30 000 sommets, ou faudra-t-il un
      decoupage en tuiles

## Phase 5 — Raffinement vision

- [ ] panorama synthetique depuis le MNT
- [ ] extraction de la ligne de crete de l'image camera
- [ ] recalage, correction du cap

Seule etape ou la vision intervient, et elle corrige un capteur — elle ne
classifie rien. Ne pas la commencer avant que le pipeline geometrique soit
stable et eprouve sur le terrain.

## Phase 6 — Polish

- [ ] mode hors ligne complet verifie
- [ ] export photo annotee
- [ ] typographie, densite d'information
