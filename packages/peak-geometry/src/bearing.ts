import type { GeoPoint } from '@ppf/shared-types';
import { normalizeBearing, toDegrees, toRadians } from './angles';

/**
 * Gisement initial (azimut de depart) de `from` vers `to`, en degres depuis le
 * Nord geographique, sens horaire.
 *
 * Sur un grand cercle le cap evolue le long du trajet ; c'est bien le gisement
 * *initial* qui donne la direction dans laquelle pointer depuis l'observateur.
 */
export function initialBearing(from: GeoPoint, to: GeoPoint): number {
  const phi1 = toRadians(from.latitude);
  const phi2 = toRadians(to.latitude);
  const deltaLambda = toRadians(to.longitude - from.longitude);

  const y = Math.sin(deltaLambda) * Math.cos(phi2);
  const x =
    Math.cos(phi1) * Math.sin(phi2) -
    Math.sin(phi1) * Math.cos(phi2) * Math.cos(deltaLambda);

  return normalizeBearing(toDegrees(Math.atan2(y, x)));
}
