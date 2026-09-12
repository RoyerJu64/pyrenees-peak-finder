/** Rayon moyen de la Terre (IUGG), en metres. */
export const EARTH_RADIUS_M = 6_371_008.8;

/**
 * Coefficient de refraction atmospherique standard.
 *
 * Les rayons lumineux rasants se courbent vers le sol, ce qui fait paraitre les
 * sommets lointains plus hauts qu'ils ne le sont geometriquement. La valeur 0.13
 * est la constante usuelle en geodesie et en construction de panoramas ; elle
 * varie en pratique avec le gradient thermique (inversions matinales comprises).
 */
export const REFRACTION_COEFFICIENT = 0.13;

/**
 * Rayon terrestre effectif : absorbe la refraction dans la courbure, de sorte
 * que l'abaissement apparent d'une cible a la distance d vaut d^2 / (2 * Re).
 */
export const EFFECTIVE_EARTH_RADIUS_M = EARTH_RADIUS_M / (1 - REFRACTION_COEFFICIENT);
