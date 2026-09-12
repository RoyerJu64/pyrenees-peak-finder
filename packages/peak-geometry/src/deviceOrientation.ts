import type { DeviceOrientation } from '@ppf/shared-types';
import { normalizeBearing, toDegrees } from './angles';
import { cross, dot, type Vec3 } from './vector';

/**
 * Attitude du telephone, telle que la rend `DeviceMotion.rotation`
 * d'expo-sensors : trois angles d'Euler **en radians**, convention Z-X'-Y''
 * du W3C.
 *
 * Le repere de l'appareil a X vers la droite de l'ecran, Y vers le haut de
 * l'ecran et Z sortant de l'ecran, cote utilisateur. La camera arriere vise
 * donc -Z.
 *
 * L'unite n'est pas documentee par expo-sensors. Le natif fournit des radians ;
 * si un releve terrain montrait des degres, c'est ici qu'il faudrait convertir,
 * et nulle part ailleurs.
 */
export interface DeviceRotation {
  /** Rotation autour de Z, en radians. */
  readonly alpha: number;
  /** Rotation autour de X, en radians. */
  readonly beta: number;
  /** Rotation autour de Y, en radians. */
  readonly gamma: number;
}

/**
 * Convertit l'attitude du telephone en orientation de l'axe optique.
 *
 * La matrice de rotation appareil -> terrestre vaut `Rz(alpha) Rx(beta) Ry(gamma)`.
 * On en tire deux vecteurs :
 *  - l'axe optique, `R * (0, 0, -1)`, qui donne cap et inclinaison
 *  - le haut de l'ecran, deuxieme colonne de `R`, qui donne le roulis
 *
 * Le roulis est mesure par rapport a l'horizontale du cap courant, exactement
 * la reference qu'utilise `cameraBasis` pour reconstruire le repere : les deux
 * fonctions doivent s'accorder, sinon un telephone incline ferait pivoter les
 * etiquettes dans le mauvais sens.
 */
export function orientationFromDeviceRotation(rotation: DeviceRotation): DeviceOrientation {
  const cosAlpha = Math.cos(rotation.alpha);
  const sinAlpha = Math.sin(rotation.alpha);
  const cosBeta = Math.cos(rotation.beta);
  const sinBeta = Math.sin(rotation.beta);
  const cosGamma = Math.cos(rotation.gamma);
  const sinGamma = Math.sin(rotation.gamma);

  // Axe optique : oppose de la troisieme colonne de R.
  const forward: Vec3 = {
    east: -(cosAlpha * sinGamma + sinAlpha * sinBeta * cosGamma),
    north: cosAlpha * sinBeta * cosGamma - sinAlpha * sinGamma,
    up: -cosBeta * cosGamma,
  };

  // Haut de l'ecran : deuxieme colonne de R.
  const screenUp: Vec3 = {
    east: -sinAlpha * cosBeta,
    north: cosAlpha * cosBeta,
    up: sinBeta,
  };

  const heading = normalizeBearing(toDegrees(Math.atan2(forward.east, forward.north)));
  const pitch = toDegrees(Math.asin(Math.min(1, Math.max(-1, forward.up))));

  // Reference horizontale du cap, identique a celle de cameraBasis.
  const levelRight: Vec3 = {
    east: Math.cos((heading * Math.PI) / 180),
    north: -Math.sin((heading * Math.PI) / 180),
    up: 0,
  };
  const levelUp = cross(levelRight, forward);
  const roll = toDegrees(Math.atan2(-dot(screenUp, levelRight), dot(screenUp, levelUp)));

  return { heading, pitch, roll };
}

/**
 * Decale le cap d'une orientation, en degres.
 *
 * Sert a deux choses : absorber le referentiel arbitraire dont part l'attitude
 * sur certaines plateformes, et laisser l'utilisateur rattraper a la main la
 * derive du magnetometre, qui atteint plusieurs degres pres d'une voiture ou
 * d'un sac a armature. A 15 km, deux degres deplacent une etiquette d'un
 * demi-kilometre de terrain.
 */
export function applyHeadingOffset(
  orientation: DeviceOrientation,
  offsetDegrees: number,
): DeviceOrientation {
  return { ...orientation, heading: normalizeBearing(orientation.heading + offsetDegrees) };
}
