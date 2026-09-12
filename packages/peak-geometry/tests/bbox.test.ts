import { describe, expect, it } from 'vitest';
import type { GeoPoint } from '@ppf/shared-types';
import { boundingBoxAround } from '../src/bbox';
import { haversineDistance } from '../src/distance';
import { EARTH_RADIUS_M } from '../src/constants';
import { LARUNS } from './fixtures';

/**
 * Formule directe de navigation spherique : point situe a `distance` metres du
 * depart dans la direction `bearing`. Independante du code teste, elle sert de
 * generateur de points dont on sait qu'ils sont exactement sur le cercle.
 */
function destinationPoint(from: GeoPoint, bearing: number, distance: number): GeoPoint {
  const delta = distance / EARTH_RADIUS_M;
  const theta = (bearing * Math.PI) / 180;
  const phi1 = (from.latitude * Math.PI) / 180;
  const lambda1 = (from.longitude * Math.PI) / 180;

  const phi2 = Math.asin(
    Math.sin(phi1) * Math.cos(delta) + Math.cos(phi1) * Math.sin(delta) * Math.cos(theta),
  );
  const lambda2 =
    lambda1 +
    Math.atan2(
      Math.sin(theta) * Math.sin(delta) * Math.cos(phi1),
      Math.cos(delta) - Math.sin(phi1) * Math.sin(phi2),
    );

  return { latitude: (phi2 * 180) / Math.PI, longitude: (lambda2 * 180) / Math.PI };
}

describe('boundingBoxAround', () => {
  it('encadre le centre', () => {
    const box = boundingBoxAround(LARUNS, 30_000);
    expect(box.minLatitude).toBeLessThan(LARUNS.latitude);
    expect(box.maxLatitude).toBeGreaterThan(LARUNS.latitude);
    expect(box.minLongitude).toBeLessThan(LARUNS.longitude);
    expect(box.maxLongitude).toBeGreaterThan(LARUNS.longitude);
    expect(box.crossesAntimeridian).toBe(false);
  });

  it('contient tous les points du cercle de rayon demande', () => {
    const radius = 40_000;
    const box = boundingBoxAround(LARUNS, radius);
    for (let bearing = 0; bearing < 360; bearing += 3) {
      const point = destinationPoint(LARUNS, bearing, radius);
      expect(point.latitude).toBeGreaterThanOrEqual(box.minLatitude);
      expect(point.latitude).toBeLessThanOrEqual(box.maxLatitude);
      expect(point.longitude).toBeGreaterThanOrEqual(box.minLongitude);
      expect(point.longitude).toBeLessThanOrEqual(box.maxLongitude);
    }
  });

  it('ne surdimensionne pas la boite : le bord nord est a peu pres au rayon', () => {
    const radius = 25_000;
    const box = boundingBoxAround(LARUNS, radius);
    const northEdge = haversineDistance(LARUNS, {
      latitude: box.maxLatitude,
      longitude: LARUNS.longitude,
    });
    expect(northEdge).toBeCloseTo(radius, 0);
  });

  it('elargit la boite en longitude avec la latitude', () => {
    const equator = boundingBoxAround({ latitude: 0, longitude: 0 }, 10_000);
    const pyrenees = boundingBoxAround({ latitude: 43, longitude: 0 }, 10_000);
    const span = (b: { minLongitude: number; maxLongitude: number }) => b.maxLongitude - b.minLongitude;
    expect(span(pyrenees)).toBeGreaterThan(span(equator));
  });

  it('signale le franchissement de l antimeridien', () => {
    const box = boundingBoxAround({ latitude: 0, longitude: 179.95 }, 20_000);
    expect(box.crossesAntimeridian).toBe(true);
    expect(box.minLongitude).toBeGreaterThan(box.maxLongitude);
    expect(box.maxLongitude).toBeGreaterThanOrEqual(-180);
    expect(box.minLongitude).toBeLessThanOrEqual(180);
  });

  it('couvre toutes les longitudes pres du pole', () => {
    const box = boundingBoxAround({ latitude: 89.999, longitude: 0 }, 50_000);
    expect(box.minLongitude).toBe(-180);
    expect(box.maxLongitude).toBe(180);
  });
});
