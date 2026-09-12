# Sources de donnees

## Emprise MVP

`data/scripts/config.py` fait autorite : `MVP_BBOX = 42.65, -0.95, 43.25, -0.15`.

L'emprise deborde volontairement les vallees d'Ossau et d'Aspe. Depuis une
vallee pyreneenne, la ligne d'horizon porte a plusieurs dizaines de kilometres,
souvent sur le versant espagnol. Un sommet visible mais absent de la base est un
trou fonctionnel, pas une economie de place : 1263 sommets pesent 240 Kio.

Bornes : le pic d'Anie a l'ouest, le Balaitous a l'est, la sierra de Tendenera
et Sallent de Gallego au sud, le piemont bearnais au nord.

## Chaine de traitement

Les quatre etapes sont independantes et rejouables. Seule la premiere touche au
reseau pour OSM, la deuxieme pour Wikidata/Wikipedia ; les deux suivantes
travaillent hors ligne.

```
python3 data/scripts/fetch_osm_peaks.py     # Overpass  -> data/raw/osm_peaks.json
python3 data/scripts/enrich_wikidata.py     # Wikidata  -> data/raw/wikidata_enrichment.json
python3 data/scripts/build_sqlite.py        # assemble  -> data/processed/peaks.sqlite
python3 data/scripts/validate_dataset.py    # controle  (code de sortie 1 si echec)
```

`data/raw/` n'est pas versionne : regenerable a la demande. `data/processed/peaks.sqlite`
l'est, parce que c'est lui qui part dans le bundle de l'application.

## OpenStreetMap — position et altitude

Requete Overpass : les noeuds `natural=peak` de l'emprise. Les sommets sont
modelises en noeuds dans OSM ; interroger ways et relations ne ramenerait que
des cretes et des zones.

Etat de l'extraction du 12 septembre 2026 :

| | |
|---|---|
| noeuds `natural=peak` ramenes | 1378 |
| retenus en base | 1263 |
| ecartes, sans nom | 37 |
| ecartes, sans tag `ele` | 77 |
| ecartes, altitude invraisemblable | 1 |

Un sommet sans altitude est inutilisable : l'angle d'elevation en depend. Un
sommet sans nom n'a rien a afficher. Les deux sont ecartes a la construction,
pas masques a l'affichage.

Le rejet pour altitude invraisemblable a attrape `Cap de Pene Rouye`
([node 9811004169](https://osm.org/node/9811004169)), tagge a 135 m dans un
massif qui culmine bien plus haut — erreur de saisie amont.

Le tag `ele` est du texte libre : `2215`, `2215.0`, `2215 m`, `2215m` circulent
tous. `parse_measurement` les accepte et rejette le reste plutot que de deviner.

## Wikidata / Wikipedia — descriptions

Trois voies de rattachement, tracees dans la colonne `match_method` :

| methode | nombre | fiabilite |
|---|---|---|
| `osm_wikidata_tag` | 94 | lien pose par un contributeur OSM, sans ambiguite |
| `osm_wikipedia_tag` | 0 | (tous les noeuds concernes portaient deja un `wikidata`) |
| `spatial_name_match` | 26 | element Wikidata de type montagne a moins de 200 m **et** meme nom normalise |

L'appariement spatial exige les deux conditions simultanement. Wikidata classe
en montagne (`Q8502`) des objets qui n'en sont pas — la requete SPARQL ramene
par exemple un « Puerto Rico » a 42.69 N — et les Pyrenees alignent les
homonymes. Un seul critere produirait des descriptions fausses, ce qui est pire
qu'une absence de description. Quand deux candidats homonymes tombent dans le
rayon, le script renonce au lieu de choisir.

La normalisation des noms retire accents, casse, ponctuation et generiques
(`pic`, `pico`, `punta`, `soum`, `tuc`, articles...) : « Pic du Midi d'Ossau »
et « pic du Midi d'Ossau » se reduisent tous deux a `midi ossau`.

Le texte affiche vient du resume REST de Wikipedia (premiere phrase deja
degagee), coupe a 400 caracteres sur une fin de phrase. A defaut, la description
courte Wikidata. Preference de langue : `fr`, `es`, `oc`, `ca`, `eu`, `an`, `en`.

**Couverture : 120 sommets sur 1263, soit 10 %.** C'est la realite de la
couverture encyclopedique des sommets secondaires, pas un defaut du pipeline :
les sommets notables sont decrits, les innombrables soums et turons anonymes ne
le sont pas. 205 sommets au-dessus de 2500 m restent sans description —
`validate_dataset.py` le signale a chaque execution. Combler ce manque demande
une redaction manuelle ou une autre source, pas un reglage de script.

## Schema SQLite

```sql
peaks(id TEXT PK, osm_id INTEGER UNIQUE, name TEXT, latitude REAL,
      longitude REAL, altitude REAL, prominence REAL, wikidata_id TEXT,
      description TEXT, wikipedia_url TEXT, match_method TEXT)
INDEX idx_peaks_lat_lon ON peaks(latitude, longitude)

dataset_metadata(key TEXT PK, value TEXT)
```

`id` a la forme `osm:node/<id>` : prefixe par la source, pour qu'un futur apport
IGN ou Wikidata puisse cohabiter sans collision d'identifiants.

L'index est un B-tree composite, pas un R-tree : la requete de l'application est
toujours un rectangle (cf. `boundingBoxAround`), SQLite restreint sur la latitude
puis filtre la longitude. Le module R-tree n'est pas garanti present dans le
SQLite embarque par Expo ; a 1263 lignes, et meme aux ~30 000 de la chaine
entiere, la difference ne se mesure pas.

`dataset_metadata` porte la date de construction, l'emprise, les effectifs et la
version de schema : sans elle, impossible de savoir quelle extraction tourne sur
le telephone d'un utilisateur.

## Licences

| source | licence | obligation |
|---|---|---|
| OpenStreetMap | ODbL | attribution + partage a l'identique des donnees derivees |
| Wikidata | CC0 | aucune |
| Wikipedia | CC BY-SA | attribution + lien vers l'article |
| Copernicus GLO-30 | libre, attribution | attribution (phase 3) |

L'application doit afficher ces attributions. `peaks.sqlite` les porte dans
`dataset_metadata.source`.

## MNT (phase 3)

Copernicus GLO-30, 30 m, mondial, gratuit. Non encore integre : le test
d'occlusion arrive en phase 3, apres l'overlay geometrique simple.
`build_dem_cache.py` sera ecrit a ce moment-la.

Migration possible vers IGN RGE ALTI (5 m, France seule) si la precision de 30 m
se revele insuffisante. Elle ne couvrirait pas le versant espagnol, tres present
dans le champ depuis les deux vallees — un panachage serait alors necessaire.
