import { toDegrees } from './angles';
import { EFFECTIVE_EARTH_RADIUS_M } from './constants';

/**
 * Abaissement apparent d'une cible du a la courbure terrestre, attenue par la
 * refraction atmospherique. En metres, toujours positif.
 *
 * ~0.7 m a 3 km, ~19 m a 15 km, ~76 m a 30 km : negligeable a l'echelle d'une
 * vallee, determinant des qu'on vise l'autre versant de la chaine.
 */
export function curvatureDrop(horizontalDistance: number): number {
  return (horizontalDistance * horizontalDistance) / (2 * EFFECTIVE_EARTH_RADIUS_M);
}

/**
 * Angle d'elevation apparent d'une cible, en degres.
 * 0 = horizon, positif vers le haut.
 *
 * @param heightDifference altitude de la cible moins altitude de l'observateur, en metres
 * @param horizontalDistance distance horizontale observateur -> cible, en metres
 */
export function elevationAngle(
  heightDifference: number,
  horizontalDistance: number,
): number {
  if (horizontalDistance <= 0) {
    return heightDifference >= 0 ? 90 : -90;
  }
  const apparentRise = heightDifference - curvatureDrop(horizontalDistance);
  return toDegrees(Math.atan2(apparentRise, horizontalDistance));
}
