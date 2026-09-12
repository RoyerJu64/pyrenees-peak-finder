import type { PeakSighting, VisibilityStatus } from '@ppf/shared-types';

/**
 * Rang de visibilite. `unknown` passe devant `occluded` : un sommet non
 * contredit vaut mieux qu'un sommet dont on sait le relief devant lui.
 */
const VISIBILITY_RANK: Record<VisibilityStatus, number> = {
  visible: 0,
  unknown: 1,
  occluded: 2,
};

/**
 * Taille apparente d'un sommet dans le cadre : l'angle sous lequel il s'eleve
 * au-dessus de l'horizontale de l'observateur, en degres.
 *
 * C'est le seul critere d'encombrement visuel disponible pour tous les sommets.
 * La proeminence discriminerait mieux — elle dit de combien le sommet se
 * detache de son propre relief — mais OSM ne la porte que sur 43 des 1263
 * sommets de l'emprise : s'en servir comme critere principal ferait disparaitre
 * les 97 % restants. Elle sert donc de departage.
 *
 * Plancher a zero : un sommet sous l'horizon n'est pas « moins grand » qu'un
 * autre encore plus bas, il est simplement en contrebas.
 */
export function apparentSize(sighting: PeakSighting): number {
  return Math.max(0, sighting.elevationAngle);
}

/**
 * Ordre de pertinence pour l'affichage, du plus interessant au moins.
 *
 * Trois criteres, dans cet ordre :
 *   1. ce qu'on voit passe avant ce qui est cache
 *   2. ce qui a une description passe avant ce qui n'en a pas — un nom seul
 *      renseigne moins, et la description signale aussi un sommet notable
 *   3. la taille apparente
 *
 * Les departages qui suivent (proeminence, distance, identifiant) n'ont pas de
 * valeur editoriale : ils garantissent un ordre total et stable, pour que
 * l'overlay ne se reorganise pas d'une image a l'autre a criteres egaux.
 */
export function compareByRelevance(a: PeakSighting, b: PeakSighting): number {
  const visibility = VISIBILITY_RANK[a.visibility] - VISIBILITY_RANK[b.visibility];
  if (visibility !== 0) {
    return visibility;
  }

  const described = Number(b.peak.description != null) - Number(a.peak.description != null);
  if (described !== 0) {
    return described;
  }

  const size = apparentSize(b) - apparentSize(a);
  if (Math.abs(size) > 1e-9) {
    return size;
  }

  const prominence = (b.peak.prominence ?? 0) - (a.peak.prominence ?? 0);
  if (prominence !== 0) {
    return prominence;
  }

  const distance = a.distance - b.distance;
  if (distance !== 0) {
    return distance;
  }

  return a.peak.id < b.peak.id ? -1 : a.peak.id > b.peak.id ? 1 : 0;
}

export interface RankingOptions {
  /** Ecarter les sommets juges caches. Defaut : true. */
  readonly excludeOccluded?: boolean;
  /**
   * Ecarter aussi ceux dont la visibilite n'a pas pu etre tranchee. Defaut :
   * false — tant que le MNT n'est pas la, presque tout est `unknown` et
   * l'activer viderait l'overlay.
   */
  readonly requireKnownVisibility?: boolean;
  /** Nombre maximal de sommets retenus. */
  readonly limit?: number;
}

/**
 * Trie les visees par pertinence et ecarte ce qui est cache.
 *
 * A appeler avant la mise en page des etiquettes : sans cela, l'anti-collision
 * arbitre sur un critere de place et non de pertinence, et un sommet majeur se
 * fait evincer par un mamelon anonyme mieux positionne.
 */
export function rankByRelevance<T extends PeakSighting>(
  sightings: readonly T[],
  options: RankingOptions = {},
): T[] {
  const excludeOccluded = options.excludeOccluded ?? true;
  const requireKnownVisibility = options.requireKnownVisibility ?? false;

  const kept = sightings.filter((sighting) => {
    if (excludeOccluded && sighting.visibility === 'occluded') {
      return false;
    }
    return !(requireKnownVisibility && sighting.visibility === 'unknown');
  });

  kept.sort(compareByRelevance);
  return options.limit === undefined ? kept : kept.slice(0, options.limit);
}
