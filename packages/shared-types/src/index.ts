/**
 * Types partages entre le pipeline de donnees, la logique geometrique et l'app mobile.
 *
 * Conventions d'unites, valables pour tout le monorepo :
 *  - latitudes / longitudes en degres decimaux, WGS84
 *  - altitudes et distances en metres
 *  - angles (gisement, elevation, FOV) en degres
 *  - gisement : 0 = Nord geographique, sens horaire, plage [0, 360[
 *  - angle d'elevation : 0 = horizon, positif vers le haut, plage ]-90, 90[
 */

/** Coordonnees horizontales WGS84. */
export interface GeoPoint {
  readonly latitude: number;
  readonly longitude: number;
}

/** Point geographique situe en altitude (metres au-dessus du niveau de la mer). */
export interface GeoPointZ extends GeoPoint {
  readonly altitude: number;
}

/** Position de l'observateur, telle que fournie par le GPS du telephone. */
export interface ObserverPosition extends GeoPointZ {
  /** Precision horizontale annoncee par le GPS, en metres. */
  readonly horizontalAccuracy?: number;
  /** Precision verticale annoncee par le GPS, en metres. */
  readonly verticalAccuracy?: number;
}

/** Un sommet du referentiel embarque. */
export interface Peak extends GeoPointZ {
  /** Identifiant stable, forme `osm:node/<id>`. */
  readonly id: string;
  readonly name: string;
  /** Proeminence topographique en metres, quand OSM la renseigne. */
  readonly prominence: number | null;
  /** Identifiant Wikidata (`Q...`), quand il existe. */
  readonly wikidataId: string | null;
  /** Description courte, issue de Wikidata/Wikipedia. */
  readonly description: string | null;
  /** URL de l'article Wikipedia, langue preferee d'abord. */
  readonly wikipediaUrl: string | null;
}

/**
 * Orientation du telephone dans le repere terrestre.
 * Fournie par la fusion magnetometre + accelerometre + gyroscope.
 */
export interface DeviceOrientation {
  /** Cap vise par l'axe optique de la camera, en degres, Nord geographique. */
  readonly heading: number;
  /** Inclinaison de l'axe optique : 0 = horizontal, positif vers le ciel. */
  readonly pitch: number;
  /** Rotation autour de l'axe optique : 0 = haut de l'image vers le zenith. */
  readonly roll: number;
  /**
   * Incertitude estimee du cap, en degres. Le magnetometre derive :
   * cette valeur sert a elargir la fenetre de recherche, pas a la centrer.
   */
  readonly headingAccuracy?: number;
}

/** Champ de vision de la camera active, en degres. */
export interface CameraFieldOfView {
  readonly horizontal: number;
  readonly vertical: number;
}

/** Dimensions du viewport de rendu, en pixels logiques. */
export interface Viewport {
  readonly width: number;
  readonly height: number;
}

/**
 * Statut de visibilite d'un sommet depuis la position de l'observateur.
 *  - `visible`  : ligne de vue degagee selon le MNT
 *  - `occluded` : un relief plus proche masque le sommet
 *  - `unknown`  : pas de donnee MNT disponible sur le trajet (MVP sans occlusion)
 */
export type VisibilityStatus = 'visible' | 'occluded' | 'unknown';

/** Resultat du calcul geometrique pour un sommet, avant projection ecran. */
export interface PeakSighting {
  readonly peak: Peak;
  /** Distance horizontale (grand cercle) observateur -> sommet, en metres. */
  readonly distance: number;
  /** Gisement observateur -> sommet, en degres. */
  readonly bearing: number;
  /** Angle d'elevation apparent, courbure terrestre et refraction comprises. */
  readonly elevationAngle: number;
  readonly visibility: VisibilityStatus;
}

/** Sommet projete dans le viewport, pret a etre etiquete. */
export interface ProjectedPeak extends PeakSighting {
  /** Abscisse en pixels logiques, origine en haut a gauche du viewport. */
  readonly x: number;
  /** Ordonnee en pixels logiques, origine en haut a gauche du viewport. */
  readonly y: number;
  /** Ecart angulaire entre l'axe optique et le sommet, en degres. */
  readonly angularOffset: number;
}
