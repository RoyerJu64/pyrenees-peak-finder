import { describe, expect, it } from 'vitest';
import { bearingDelta, clamp, normalizeBearing, toDegrees, toRadians } from '../src/angles';

describe('toRadians / toDegrees', () => {
  it('converge dans les deux sens', () => {
    expect(toRadians(180)).toBeCloseTo(Math.PI, 12);
    expect(toDegrees(Math.PI / 2)).toBeCloseTo(90, 12);
    expect(toDegrees(toRadians(37.5))).toBeCloseTo(37.5, 12);
  });
});

describe('normalizeBearing', () => {
  it('ramene dans [0, 360[', () => {
    expect(normalizeBearing(0)).toBe(0);
    expect(normalizeBearing(360)).toBe(0);
    expect(normalizeBearing(370)).toBeCloseTo(10, 12);
    expect(normalizeBearing(-10)).toBeCloseTo(350, 12);
    expect(normalizeBearing(-730)).toBeCloseTo(350, 12);
  });
});

describe('bearingDelta', () => {
  it('prend toujours le chemin le plus court', () => {
    expect(bearingDelta(10, 20)).toBeCloseTo(10, 12);
    expect(bearingDelta(20, 10)).toBeCloseTo(-10, 12);
    expect(bearingDelta(350, 10)).toBeCloseTo(20, 12);
    expect(bearingDelta(10, 350)).toBeCloseTo(-20, 12);
  });

  it('renvoie 180 pour deux caps opposes', () => {
    expect(Math.abs(bearingDelta(0, 180))).toBeCloseTo(180, 12);
  });

  it('reste dans ]-180, 180]', () => {
    for (let from = 0; from < 360; from += 7) {
      for (let to = 0; to < 360; to += 11) {
        const delta = bearingDelta(from, to);
        expect(delta).toBeGreaterThan(-180);
        expect(delta).toBeLessThanOrEqual(180);
      }
    }
  });
});

describe('clamp', () => {
  it('borne la valeur', () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(clamp(11, 0, 10)).toBe(10);
  });
});
