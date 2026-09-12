export const toRadians = (degrees: number): number => (degrees * Math.PI) / 180;

export const toDegrees = (radians: number): number => (radians * 180) / Math.PI;

/** Ramene un angle dans la plage [0, 360[. */
export function normalizeBearing(degrees: number): number {
  const wrapped = degrees % 360;
  return wrapped < 0 ? wrapped + 360 : wrapped;
}

/**
 * Ecart signe le plus court entre deux gisements, dans la plage ]-180, 180].
 * Positif si `to` est a droite (sens horaire) de `from`.
 */
export function bearingDelta(from: number, to: number): number {
  const delta = normalizeBearing(to - from);
  return delta > 180 ? delta - 360 : delta;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
