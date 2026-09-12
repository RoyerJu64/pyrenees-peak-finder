import type {
  ObserverPosition,
  Peak,
  PeakSighting,
  VisibilityStatus,
} from '@ppf/shared-types';
import { initialBearing } from './bearing';
import { haversineDistance } from './distance';
import { elevationAngle } from './elevation';

/**
 * Geometrie observateur -> sommet : distance, gisement, elevation apparente.
 *
 * La visibilite reste `unknown` par defaut : elle demande un MNT et se decide
 * dans une etape separee, pas ici.
 */
export function computeSighting(
  observer: ObserverPosition,
  peak: Peak,
  visibility: VisibilityStatus = 'unknown',
): PeakSighting {
  const distance = haversineDistance(observer, peak);
  return {
    peak,
    distance,
    bearing: initialBearing(observer, peak),
    elevationAngle: elevationAngle(peak.altitude - observer.altitude, distance),
    visibility,
  };
}

export interface SightingFilter {
  /** Distance maximale retenue, en metres. */
  readonly maxDistance: number;
  /**
   * Distance minimale, en metres. Ecarte le sommet sur lequel l'observateur se
   * tient deja, dont le gisement n'a aucun sens.
   */
  readonly minDistance?: number;
}

/**
 * Calcule les visees vers tous les sommets d'une plage de distance donnee,
 * triees du plus proche au plus lointain.
 */
export function computeSightings(
  observer: ObserverPosition,
  peaks: readonly Peak[],
  filter: SightingFilter,
): PeakSighting[] {
  const minDistance = filter.minDistance ?? 0;
  return peaks
    .map((peak) => computeSighting(observer, peak))
    .filter(
      (sighting) =>
        sighting.distance >= minDistance && sighting.distance <= filter.maxDistance,
    )
    .sort((a, b) => a.distance - b.distance);
}
