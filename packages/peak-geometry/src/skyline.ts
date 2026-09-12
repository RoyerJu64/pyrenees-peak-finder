import type { PeakSighting } from '@ppf/shared-types';
import { bearingDelta, toRadians } from './angles';
import { compareByRelevance } from './ranking';

export interface SkylineOptions {
  /**
   * Separation angulaire, en degres, en deca de laquelle deux sommets sont
   * consideres comme une seule silhouette.
   *
   * L'unite qui compte est angulaire et non metrique : deux sommets separes
   * de 1.5 degre se superposent a l'ecran quelle que soit leur distance, alors
   * qu'en metres cela represente 130 m a 5 km et 1.2 km a 45 km.
   */
  readonly minSeparation?: number;
  /**
   * Qui l'emporte au sein d'un groupe. Par defaut l'ordre de pertinence, qui
   * fait remonter le sommet documente : dans le massif de l'Ossau, c'est le Pic
   * du Midi qu'on veut nommer, pas la Pointe de France qui le jouxte.
   */
  readonly priority?: (a: PeakSighting, b: PeakSighting) => number;
}

const DEFAULT_MIN_SEPARATION = 1.5;

/**
 * Separation angulaire apparente entre deux visees, en degres.
 *
 * Distance sur la voute celeste, gisement et elevation confondus : deux
 * sommets au meme gisement mais a dix degres d'elevation d'ecart sont deux
 * objets bien distincts a l'ecran, l'un haut dans le cadre et l'autre sur
 * l'horizon.
 */
export function angularSeparation(a: PeakSighting, b: PeakSighting): number {
  // Les gisements convergent vers les poles : un degre de gisement couvre
  // moins de ciel a mesure qu'on regarde haut.
  const meanElevation = toRadians((a.elevationAngle + b.elevationAngle) / 2);
  const alongHorizon = bearingDelta(a.bearing, b.bearing) * Math.cos(meanElevation);
  return Math.hypot(alongHorizon, a.elevationAngle - b.elevationAngle);
}

/**
 * Ne conserve qu'un sommet par silhouette : suppression des non-maxima sur la
 * voute celeste.
 *
 * Depuis la plaine, une crete pyreneenne aligne des dizaines de sommets
 * references dans un ou deux degres de gisement. Ils forment une seule
 * silhouette, et les nommer tous revient a etiqueter dix fois la meme montagne.
 *
 * Le parcours se fait par ordre de pertinence decroissante : chaque sommet
 * retenu absorbe ceux qui tombent dans son voisinage. Un groupe conserve donc
 * toujours exactement un representant, et c'est son meilleur. Un simple seuil
 * de depassement local ne tiendrait pas cette garantie : deux sommets jumeaux a
 * quelques metres l'un de l'autre s'elimineraient mutuellement et le massif
 * entier disparaitrait.
 *
 * Complement du test d'occlusion, pas substitut : l'occlusion dit ce qui est
 * cache, celui-ci dit ce qui est distinguable.
 */
export function selectSkylinePeaks(
  sightings: readonly PeakSighting[],
  options: SkylineOptions = {},
): PeakSighting[] {
  const minSeparation = options.minSeparation ?? DEFAULT_MIN_SEPARATION;
  const priority = options.priority ?? compareByRelevance;

  const kept: PeakSighting[] = [];
  for (const sighting of [...sightings].sort(priority)) {
    const merged = kept.some(
      (representative) => angularSeparation(representative, sighting) < minSeparation,
    );
    if (!merged) {
      kept.push(sighting);
    }
  }
  return kept;
}
