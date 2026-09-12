import type { GeoPoint } from '@ppf/shared-types';
import { toRadians } from './angles';
import { EARTH_RADIUS_M } from './constants';

/**
 * Distance orthodromique (grand cercle) entre deux points, en metres.
 *
 * Formule de haversine : numeriquement stable aux petites distances, la ou la
 * loi des cosinus spheriques perd sa precision. L'erreur due au modele spherique
 * (~0.3 %) est negligeable devant l'incertitude GPS a l'echelle d'une vallee.
 */
export function haversineDistance(from: GeoPoint, to: GeoPoint): number {
  const phi1 = toRadians(from.latitude);
  const phi2 = toRadians(to.latitude);
  const deltaPhi = toRadians(to.latitude - from.latitude);
  const deltaLambda = toRadians(to.longitude - from.longitude);

  const a =
    Math.sin(deltaPhi / 2) ** 2 +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) ** 2;

  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(a)));
}
