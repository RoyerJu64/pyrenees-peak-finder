import type { ProjectedPeak, Viewport } from '@ppf/shared-types';

/** Etiquette placee dans le viewport, coin haut-gauche et dimensions. */
export interface PlacedLabel {
  readonly peak: ProjectedPeak;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface LabelLayoutOptions {
  /** Largeur de l'etiquette, fixe ou calculee depuis le sommet (longueur du nom). */
  readonly labelWidth: number | ((peak: ProjectedPeak) => number);
  readonly labelHeight: number;
  /** Espace libre minimal entre deux etiquettes, en pixels. */
  readonly gap?: number;
  /** Distance entre le point du sommet et le bas de son etiquette, en pixels. */
  readonly anchorOffset?: number;
  /**
   * Ordre de placement : la premiere servie garde sa position naturelle, les
   * suivantes remontent. Par defaut, le sommet le plus proche est prioritaire.
   */
  readonly priority?: (a: ProjectedPeak, b: ProjectedPeak) => number;
  /**
   * Remontee maximale d'une etiquette au-dessus de son sommet, en pixels.
   * Au-dela, l'etiquette est abandonnee plutot que poussee plus haut.
   *
   * Sans cette borne, une ligne d'horizon lointaine — ou tous les sommets se
   * pressent dans une bande de quelques degres — fait empiler les etiquettes
   * jusqu'en haut du cadre. Le filet de rappel ne sauve rien a cette distance :
   * un nom pose 300 px au-dessus de sa montagne se lit comme du bruit, pose
   * sur du ciel.
   *
   * Par defaut aucune borne, pour ne pas changer le comportement sans qu'on
   * l'ait voulu ; l'application, elle, en fixe une.
   */
  readonly maxRise?: number;
}

const byDistance = (a: ProjectedPeak, b: ProjectedPeak): number => a.distance - b.distance;

/**
 * Repartit les etiquettes verticalement pour qu'aucune n'en recouvre une autre.
 *
 * Un panorama pyreneen aligne facilement une dizaine de sommets dans quelques
 * degres de cap : sans deconfliction, les noms se superposent en un bloc
 * illisible. Chaque etiquette part juste au-dessus de son sommet puis remonte
 * par paliers jusqu'a trouver une place libre ; celles qui sortiraient par le
 * haut du cadre sont abandonnees plutot qu'empilees hors-champ.
 */
export function layoutLabels(
  peaks: readonly ProjectedPeak[],
  viewport: Viewport,
  options: LabelLayoutOptions,
): PlacedLabel[] {
  const gap = options.gap ?? 4;
  const anchorOffset = options.anchorOffset ?? 12;
  const step = options.labelHeight + gap;
  const priority = options.priority ?? byDistance;
  const maxRise = options.maxRise ?? Number.POSITIVE_INFINITY;
  const widthOf =
    typeof options.labelWidth === 'function' ? options.labelWidth : () => options.labelWidth as number;

  const placed: PlacedLabel[] = [];

  for (const peak of [...peaks].sort(priority)) {
    const width = widthOf(peak);
    const x = Math.min(Math.max(peak.x - width / 2, 0), Math.max(viewport.width - width, 0));

    const naturalY = peak.y - anchorOffset - options.labelHeight;
    const lowestY = naturalY - maxRise;

    let y = naturalY;
    while (y >= 0 && y >= lowestY && overlapsAny(placed, x, y, width, options.labelHeight, gap)) {
      y -= step;
    }

    if (y >= 0 && y >= lowestY) {
      placed.push({ peak, x, y, width, height: options.labelHeight });
    }
  }

  return placed;
}

function overlapsAny(
  placed: readonly PlacedLabel[],
  x: number,
  y: number,
  width: number,
  height: number,
  gap: number,
): boolean {
  return placed.some(
    (other) =>
      x < other.x + other.width + gap &&
      x + width + gap > other.x &&
      y < other.y + other.height + gap &&
      y + height + gap > other.y,
  );
}
