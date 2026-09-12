import type {
  CameraFieldOfView,
  DeviceOrientation,
  PeakSighting,
  ProjectedPeak,
  Viewport,
} from '@ppf/shared-types';
import { toDegrees, toRadians } from './angles';
import { add, cross, directionVector, dot, scale, type Vec3 } from './vector';

/** Repere de la camera dans le systeme ENU local. */
export interface CameraBasis {
  /** Axe optique. */
  readonly forward: Vec3;
  /** Droite de l'image. */
  readonly right: Vec3;
  /** Haut de l'image. */
  readonly up: Vec3;
}

/**
 * Construit le repere de la camera a partir de l'orientation du telephone.
 *
 * `roll` fait tourner l'image autour de l'axe optique : sans lui, un telephone
 * tenu de travers placerait les etiquettes le long d'un horizon qui n'est pas
 * celui affiche a l'ecran.
 */
export function cameraBasis(orientation: DeviceOrientation): CameraBasis {
  const forward = directionVector(orientation.heading, orientation.pitch);

  const heading = toRadians(orientation.heading);
  // Horizontale perpendiculaire au cap, vers la droite de l'observateur.
  const levelRight: Vec3 = { east: Math.cos(heading), north: -Math.sin(heading), up: 0 };
  const levelUp = cross(levelRight, forward);

  const roll = toRadians(orientation.roll);
  return {
    forward,
    right: add(scale(levelRight, Math.cos(roll)), scale(levelUp, Math.sin(roll))),
    up: add(scale(levelRight, -Math.sin(roll)), scale(levelUp, Math.cos(roll))),
  };
}

export interface ProjectionOptions {
  /**
   * Marge, en pixels, au-dela des bords du viewport. Un sommet juste hors cadre
   * reste projete, ce qui evite qu'une etiquette clignote quand la main tremble.
   */
  readonly overscan?: number;
}

/**
 * Projette une visee dans le viewport selon un modele de camera stenope.
 *
 * Renvoie `null` si le sommet est derriere la camera ou hors du cadre (marge
 * `overscan` comprise). Le modele rectilineaire compte : une simple regle de
 * trois entre ecart angulaire et pixels decalerait les etiquettes de bord de
 * plusieurs degres sur un grand-angle.
 */
export function projectSighting(
  sighting: PeakSighting,
  orientation: DeviceOrientation,
  fov: CameraFieldOfView,
  viewport: Viewport,
  options: ProjectionOptions = {},
): ProjectedPeak | null {
  const basis = cameraBasis(orientation);
  const target = directionVector(sighting.bearing, sighting.elevationAngle);

  const depth = dot(target, basis.forward);
  if (depth <= 1e-9) {
    return null;
  }

  const acrossX = dot(target, basis.right);
  const acrossY = dot(target, basis.up);

  const halfWidth = Math.tan(toRadians(fov.horizontal / 2));
  const halfHeight = Math.tan(toRadians(fov.vertical / 2));
  const ndcX = acrossX / depth / halfWidth;
  const ndcY = acrossY / depth / halfHeight;

  const x = ((ndcX + 1) / 2) * viewport.width;
  const y = ((1 - ndcY) / 2) * viewport.height;

  const overscan = options.overscan ?? 0;
  if (
    x < -overscan ||
    x > viewport.width + overscan ||
    y < -overscan ||
    y > viewport.height + overscan
  ) {
    return null;
  }

  return {
    ...sighting,
    x,
    y,
    // atan2 sur la composante transverse plutot qu'acos sur la composante
    // axiale : acos perd ses chiffres significatifs quand le sommet est proche
    // de l'axe optique, cas le plus frequent puisque l'utilisateur le vise.
    angularOffset: toDegrees(Math.atan2(Math.hypot(acrossX, acrossY), depth)),
  };
}

/** Projette une liste de visees, en ecartant celles qui sortent du cadre. */
export function projectSightings(
  sightings: readonly PeakSighting[],
  orientation: DeviceOrientation,
  fov: CameraFieldOfView,
  viewport: Viewport,
  options: ProjectionOptions = {},
): ProjectedPeak[] {
  const projected: ProjectedPeak[] = [];
  for (const sighting of sightings) {
    const result = projectSighting(sighting, orientation, fov, viewport, options);
    if (result !== null) {
      projected.push(result);
    }
  }
  return projected;
}
