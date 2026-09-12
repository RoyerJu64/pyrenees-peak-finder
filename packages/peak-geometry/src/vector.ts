import { toRadians } from './angles';

/**
 * Vecteur dans le repere local ENU (East, North, Up) centre sur l'observateur.
 * Les distances en jeu (< 100 km) restent tres inferieures au rayon terrestre :
 * traiter le voisinage de l'observateur comme un plan tangent est suffisant,
 * a condition que la courbure ait deja ete absorbee dans l'angle d'elevation.
 */
export interface Vec3 {
  readonly east: number;
  readonly north: number;
  readonly up: number;
}

/** Vecteur unitaire pointant vers un gisement et un angle d'elevation donnes. */
export function directionVector(bearingDeg: number, elevationDeg: number): Vec3 {
  const azimuth = toRadians(bearingDeg);
  const elevation = toRadians(elevationDeg);
  const horizontal = Math.cos(elevation);
  return {
    east: Math.sin(azimuth) * horizontal,
    north: Math.cos(azimuth) * horizontal,
    up: Math.sin(elevation),
  };
}

export function dot(a: Vec3, b: Vec3): number {
  return a.east * b.east + a.north * b.north + a.up * b.up;
}

export function cross(a: Vec3, b: Vec3): Vec3 {
  return {
    east: a.north * b.up - a.up * b.north,
    north: a.up * b.east - a.east * b.up,
    up: a.east * b.north - a.north * b.east,
  };
}

export function scale(v: Vec3, factor: number): Vec3 {
  return { east: v.east * factor, north: v.north * factor, up: v.up * factor };
}

export function add(a: Vec3, b: Vec3): Vec3 {
  return { east: a.east + b.east, north: a.north + b.north, up: a.up + b.up };
}

export function length(v: Vec3): number {
  return Math.sqrt(dot(v, v));
}
