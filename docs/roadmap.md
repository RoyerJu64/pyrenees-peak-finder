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

## Phase 2 — MVP camera + GPS + boussole + overlay — en cours

Fait : la geometrie complete, testee (71 tests unitaires).

- `boundingBoxAround` — prefiltre spatial de la requete SQL
- `computeSighting` — distance, gisement, elevation corrigee
- `projectSighting` — projection stenope, roulis compris
- `layoutLabels` — anti-collision des etiquettes

Reste a faire, cote `apps/mobile` :

- [ ] scaffold Expo (expo-router, TypeScript strict)
- [ ] chargement de `peaks.sqlite` depuis les assets (expo-sqlite, base en
      lecture seule copiee au premier lancement)
- [ ] requete spatiale locale alimentee par `boundingBoxAround`
- [ ] `expo-location` — position et altitude, gestion des permissions
- [ ] `expo-sensors` — fusion magnetometre/accelerometre en cap et inclinaison,
      lissage du bruit sans introduire de latence visible
- [ ] FOV reel de la camera active : `expo-camera` ne l'expose pas directement,
      il faudra une table par appareil ou une calibration
- [ ] overlay de rendu, etiquettes minimalistes
- [ ] fiche sommet : nom, altitude, distance, description

Deux points ouverts, a trancher avant d'ecrire l'ecran camera :

**Le FOV.** `expo-camera` ne l'expose pas. Une valeur fausse etale ou comprime
tout le panorama, sans qu'aucun test ne puisse le detecter.

**Le tri des sommets.** Verification sur le dataset reel, depuis Laruns, cap 184,
champ de 66 degres : 1158 sommets dans un rayon de 40 km, **371 tombent dans le
champ**, et l'anti-collision n'en loge que 35. Elle abandonne donc 336
etiquettes sur un critere de place, pas de pertinence — le Pic du Midi d'Ossau
peut se faire evincer par un turon anonyme mieux place. Il faut un critere de
selection en amont (proeminence, taille apparente, presence d'une description),
l'anti-collision n'etant que le dernier recours.

## Phase 3 — Occlusion via MNT

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
