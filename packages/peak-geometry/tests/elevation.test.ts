import { describe, expect, it } from 'vitest';
import { curvatureDrop, elevationAngle } from '../src/elevation';
import { toDegrees } from '../src/angles';

describe('curvatureDrop', () => {
  it('est nul a distance nulle et croit avec le carre de la distance', () => {
    expect(curvatureDrop(0)).toBe(0);
    expect(curvatureDrop(2000) / curvatureDrop(1000)).toBeCloseTo(4, 9);
  });

  it.each([
    [1000, 0.06828],
    [3000, 0.6145],
    [15_000, 15.36256],
    [30_000, 61.45024],
    [100_000, 682.78041],
  ])('vaut %d m -> %f m', (distance, expected) => {
    expect(curvatureDrop(distance)).toBeCloseTo(expected, 4);
  });
});

describe('elevationAngle', () => {
  it('vise pratiquement l horizon pour une cible a la meme altitude et distance courte', () => {
    // Pas exactement zero : meme a 100 m la courbure abaisse deja la cible.
    expect(Math.abs(elevationAngle(0, 100))).toBeLessThan(0.001);
    expect(elevationAngle(0, 100)).toBeLessThan(0);
  });

  it('est negatif pour une cible plus basse', () => {
    expect(elevationAngle(-500, 2000)).toBeLessThan(0);
  });

  it('s ecarte de facon negligeable du calcul plan a courte distance', () => {
    const naive = toDegrees(Math.atan2(1000, 2000));
    expect(Math.abs(elevationAngle(1000, 2000) - naive)).toBeLessThan(0.01);
  });

  it('abaisse la cible lointaine sous sa valeur naive', () => {
    const naive = toDegrees(Math.atan2(1000, 60_000));
    expect(elevationAngle(1000, 60_000)).toBeLessThan(naive);
  });

  it('peut faire passer sous l horizon une cible plus haute mais lointaine', () => {
    // 200 m de plus que l observateur, a 80 km : la courbure (2.2 km) l enfouit.
    expect(elevationAngle(200, 80_000)).toBeLessThan(0);
  });

  it('renvoie +/-90 a distance nulle', () => {
    expect(elevationAngle(100, 0)).toBe(90);
    expect(elevationAngle(-100, 0)).toBe(-90);
  });

  it.each([
    ['Pic du Midi d Ossau', 2884 - 523, 16_180.7301, 8.239698],
    ['Pic d Anie', 2504 - 523, 21_088.902, 5.28458],
    ['Balaitous', 3144 - 523, 19_581.0881, 7.548665],
  ])('reproduit la reference pour %s', (_name, deltaH, distance, expected) => {
    expect(elevationAngle(deltaH, distance)).toBeCloseTo(expected, 5);
  });
});
