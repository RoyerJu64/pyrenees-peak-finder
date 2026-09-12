# Architecture

## Le probleme n'est pas visuel

Identifier un sommet vise par la camera ne demande pas de reconnaitre sa forme.
Position, orientation et altitude suffisent a determiner ce qui se trouve dans
le champ. La camera n'est qu'un fond : l'application ne lit pas l'image, elle
calcule ou tombent les sommets dans le cadre et les y dessine.

Ce choix est structurant. Il rend l'application deterministe, testable au metre
pres, et utilisable hors ligne sans modele ni serveur. Il rend aussi son defaut
previsible : tout repose sur la justesse des capteurs.

## Decoupage

```
packages/shared-types     types et unites, partages par tout le monorepo
packages/peak-geometry    toute la geometrie, sans dependance a React Native
apps/mobile               camera, capteurs, rendu -- consomme peak-geometry
data/scripts              pipeline Python, independant de l'app
```

`peak-geometry` ne connait ni React, ni Expo, ni SQLite. Il prend des nombres et
rend des nombres, ce qui le rend testable en Node sans emulateur et interdit a
la logique de se disperser dans les composants d'interface. L'application mobile
consomme le package et ne reimplemente rien.

## Chaine de calcul

Pour chaque image affichee :

```
GPS ----------------\
                     +--> selection spatiale --> visee --> projection --> etiquettes
base de sommets ----/         (bbox SQL)       (geometrie)  (stenope)   (anti-collision)
                                                              ^
boussole + accelerometre -------------------------------------/
```

### 1. Selection spatiale

`boundingBoxAround(position, rayon)` produit le rectangle qui part dans le
`WHERE` indexe de SQLite. Boucler sur toute la base pour calculer des haversines
serait inutile : le rectangle elimine d'abord, la distance exacte tranche
ensuite.

La boite est calculee sur le parallele le plus etroit qu'elle touche, ce qui la
rend legerement conservatrice — elle ne tronque jamais le cercle demande.

### 2. Visee

Pour chaque sommet candidat, `computeSighting` etablit :

- **distance** — haversine, stable aux courtes distances la ou la loi des
  cosinus spheriques perd ses chiffres significatifs
- **gisement** — azimut initial du grand cercle
- **angle d'elevation** — `atan2(dh - d^2 / 2Re, d)`

La correction de courbure compte. A 30 km, un sommet parait 61 m plus bas qu'un
calcul plan ne le donnerait, soit environ 0.12 degre — plus que la largeur d'une
etiquette. La refraction atmospherique compense une partie de cet abaissement ;
elle est absorbee dans un rayon terrestre effectif `R / (1 - 0.13)`.

### 3. Projection

Modele stenope complet, pas une regle de trois. Un ecart angulaire converti
lineairement en pixels placerait correctement le centre et les bords du cadre,
et se tromperait partout entre les deux : a mi-champ d'un objectif de 60
degres, l'ecart atteint 2 % de la largeur de l'ecran.

L'orientation est transformee en triedre (`forward`, `right`, `up`), roulis
compris, puis le vecteur du sommet y est projete. Le roulis n'est pas un detail
d'agrement : sans lui, un telephone tenu de travers aligne ses etiquettes sur un
horizon qui n'est pas celui affiche a l'ecran.

L'ecart angulaire a l'axe optique est calcule par `atan2` sur la composante
transverse plutot que par `acos` sur la composante axiale : `acos` perd sa
precision pres de zero, cas le plus frequent puisque c'est precisement la que
l'utilisateur vise.

### 4. Etiquettes

`layoutLabels` empile verticalement les etiquettes qui se chevaucheraient. Un
panorama pyreneen aligne facilement dix sommets dans quelques degres de cap ;
sans deconfliction, les noms se superposent en un bloc illisible. Chaque
etiquette part au-dessus de son sommet et remonte par paliers ; celles qui
sortiraient du cadre par le haut sont abandonnees plutot qu'empilees hors-champ.

L'ordre de service est injectable. Par defaut le sommet le plus proche garde sa
place naturelle.

## Ce qui n'est pas encore la

**Occlusion (phase 3).** Rien ne rejette aujourd'hui un sommet cache derriere
une crete plus proche. Le champ `visibility` existe dans les types et vaut
`unknown` partout. Le test demande un MNT et un ray-marching le long du gisement.

**Derive du magnetometre (phase 5).** La boussole d'un telephone derive de
plusieurs degres, davantage pres d'une voiture ou d'un sac a armature. A 15 km,
2 degres d'erreur deplacent l'etiquette d'un demi-kilometre sur le terrain. Le
raffinement prevu extrait la ligne de crete de l'image et la recale contre un
panorama synthetique calcule depuis le MNT. C'est la seule etape ou la vision
intervient, et elle corrige un capteur — elle ne classifie rien.

En attendant, `DeviceOrientation.headingAccuracy` porte l'incertitude annoncee
par le capteur. Elle sert a elargir la fenetre de recherche, pas a la centrer.

## Hors ligne

Aucun backend. La base tient dans le bundle (240 Kio pour 1263 sommets), les
capteurs sont locaux, le calcul est local. C'est une contrainte de terrain avant
d'etre un choix technique : les vallees d'Ossau et d'Aspe n'ont pas de reseau
au-dessus de 1500 m.

Un backend FastAPI redeviendrait pertinent si le dataset de la chaine entiere
cessait de tenir embarque. A 240 Kio pour deux vallees, la chaine complete
devrait rester sous quelques mega-octets : l'echeance n'est pas proche.
