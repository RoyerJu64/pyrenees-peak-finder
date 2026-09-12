import type { GeoPoint } from '@ppf/shared-types';
import { clamp, toDegrees, toRadians } from './angles';
import { EARTH_RADIUS_M } from './constants';

/** Rectangle englobant en coordonnees geographiques. */
export interface BoundingBox {
  readonly minLatitude: number;
  readonly maxLatitude: number;
  readonly minLongitude: number;
  readonly maxLongitude: number;
  /**
   * Vrai si la boite franchit l'antimeridien : `minLongitude > maxLongitude`,
   * et une requete SQL doit alors tester `lon >= min OR lon <= max`.
   */
  readonly crossesAntimeridian: boolean;
}

/**
 * Boite englobant tous les points situes a moins de `radius` metres du centre.
 *
 * Sert de prefiltre a la requete spatiale : c'est ce rectangle qui part dans le
 * `WHERE` indexe de SQLite, avant le filtrage exact a la distance. Boucler sur
 * toute la base pour calculer des haversines serait inutilement couteux.
 */
export function boundingBoxAround(center: GeoPoint, radius: number): BoundingBox {
  const latDelta = toDegrees(radius / EARTH_RADIUS_M);
  const minLatitude = clamp(center.latitude - latDelta, -90, 90);
  const maxLatitude = clamp(center.latitude + latDelta, -90, 90);

  // Le parallele retrecit avec la latitude : un degre de longitude y couvre
  // moins de terrain. On dimensionne sur le parallele le plus etroit de la
  // boite, celui le plus proche du pole, pour ne rien tronquer.
  const worstLatitude = Math.max(Math.abs(minLatitude), Math.abs(maxLatitude));
  const cosLatitude = Math.cos(toRadians(worstLatitude));

  if (cosLatitude < 1e-9 || radius / (EARTH_RADIUS_M * cosLatitude) >= Math.PI) {
    return {
      minLatitude,
      maxLatitude,
      minLongitude: -180,
      maxLongitude: 180,
      crossesAntimeridian: false,
    };
  }

  const lonDelta = toDegrees(radius / (EARTH_RADIUS_M * cosLatitude));
  const rawMin = center.longitude - lonDelta;
  const rawMax = center.longitude + lonDelta;
  const crossesAntimeridian = rawMin < -180 || rawMax > 180;

  return {
    minLatitude,
    maxLatitude,
    minLongitude: crossesAntimeridian ? wrapLongitude(rawMin) : rawMin,
    maxLongitude: crossesAntimeridian ? wrapLongitude(rawMax) : rawMax,
    crossesAntimeridian,
  };
}

function wrapLongitude(longitude: number): number {
  const wrapped = ((longitude + 180) % 360 + 360) % 360;
  return wrapped - 180;
}
