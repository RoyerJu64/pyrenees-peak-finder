import type { PeakSighting, VisibilityStatus } from '@ppf/shared-types';
import { bearingDelta } from './angles';

export interface PeakOcclusionOptions {
  /**
   * Demi-largeur angulaire, en degres, du secteur qu'un sommet est repute
   * masquer. La base ne contient que des points : cette tolerance represente
   * la masse du relief autour du sommet, dont on n'a pas la forme.
   */
  readonly angularRadius?: number;
  /**
   * Ecart d'elevation, en degres, au-dela duquel on conclut a l'occlusion.
   * Une marge evite de condamner un sommet sur un ecart qui tient au bruit du
   * MNT source ou a l'imprecision de l'altitude OSM.
   */
  readonly elevationMargin?: number;
}

const DEFAULT_ANGULAR_RADIUS = 0.5;
const DEFAULT_ELEVATION_MARGIN = 0.2;

/**
 * Determine, a partir des seuls sommets connus, lesquels sont masques.
 *
 * Le raisonnement est sur : un sommet est un maximum local du relief. Si un
 * sommet plus proche, sur sensiblement le meme gisement, se presente sous un
 * angle d'elevation plus eleve, alors le terrain coupe la ligne de visee et ce
 * qui est derriere est bien cache.
 *
 * Ce test est donc fiable quand il se declenche, et tres incomplet : il ne voit
 * que les sommets. Or en fond de vallee, ce qui masque l'horizon est le versant
 * d'en face, pas un sommet — et le versant n'existe pas dans la base. Les
 * sommets qu'il laisse en `visible` ne sont pas garantis visibles, seulement
 * non contredits. Le ray-marching sur MNT de la phase 3 comblera l'ecart en
 * remplissant le meme champ `visibility`, sans changer les appelants.
 *
 * Cout quadratique, assume : la passe se relance quand la position change, pas
 * a chaque image. A 1200 sommets elle reste sous la milliseconde.
 */
export function markPeakOcclusion(
  sightings: readonly PeakSighting[],
  options: PeakOcclusionOptions = {},
): PeakSighting[] {
  const angularRadius = options.angularRadius ?? DEFAULT_ANGULAR_RADIUS;
  const elevationMargin = options.elevationMargin ?? DEFAULT_ELEVATION_MARGIN;

  // Du plus proche au plus lointain : quand on traite un sommet, tout ce qui
  // peut le masquer a deja ete vu.
  const ordered = [...sightings].sort((a, b) => a.distance - b.distance);
  const blockers: { bearing: number; elevationAngle: number }[] = [];
  const decided = new Map<string, VisibilityStatus>();

  for (const sighting of ordered) {
    const occluded = blockers.some(
      (blocker) =>
        Math.abs(bearingDelta(blocker.bearing, sighting.bearing)) <= angularRadius &&
        blocker.elevationAngle >= sighting.elevationAngle + elevationMargin,
    );
    decided.set(sighting.peak.id, occluded ? 'occluded' : 'unknown');
    blockers.push({ bearing: sighting.bearing, elevationAngle: sighting.elevationAngle });
  }

  // L'ordre d'entree est preserve : l'appelant a pu le choisir.
  return sightings.map((sighting) => {
    const status = decided.get(sighting.peak.id);
    return status === undefined || status === sighting.visibility
      ? sighting
      : { ...sighting, visibility: status };
  });
}
