import { describe, expect, it } from 'vitest';
import type { ProjectedPeak, Viewport } from '@ppf/shared-types';
import { layoutLabels, type PlacedLabel } from '../src/labels';
import { makePeak } from './fixtures';

const VIEWPORT: Viewport = { width: 400, height: 800 };
const OPTIONS = { labelWidth: 120, labelHeight: 20, gap: 4, anchorOffset: 10 };

function projected(name: string, x: number, y: number, distance: number): ProjectedPeak {
  return {
    peak: makePeak({ name, latitude: 0, longitude: 0, altitude: 0 }),
    distance,
    bearing: 0,
    elevationAngle: 0,
    visibility: 'unknown',
    x,
    y,
    angularOffset: 0,
  };
}

function overlaps(a: PlacedLabel, b: PlacedLabel): boolean {
  return (
    a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y
  );
}

describe('layoutLabels', () => {
  it('centre une etiquette isolee au-dessus de son sommet', () => {
    const [label] = layoutLabels([projected('Anie', 200, 400, 1000)], VIEWPORT, OPTIONS);
    expect(label!.x).toBeCloseTo(200 - 60, 9);
    expect(label!.y).toBeCloseTo(400 - 10 - 20, 9);
  });

  it('separe des etiquettes qui se chevaucheraient', () => {
    const labels = layoutLabels(
      [projected('A', 200, 400, 1000), projected('B', 210, 405, 2000), projected('C', 195, 398, 3000)],
      VIEWPORT,
      OPTIONS,
    );
    expect(labels).toHaveLength(3);
    for (let i = 0; i < labels.length; i += 1) {
      for (let j = i + 1; j < labels.length; j += 1) {
        expect(overlaps(labels[i]!, labels[j]!)).toBe(false);
      }
    }
  });

  it('sert le sommet le plus proche en premier', () => {
    const labels = layoutLabels(
      [projected('Loin', 200, 400, 20_000), projected('Pres', 200, 400, 2000)],
      VIEWPORT,
      OPTIONS,
    );
    const pres = labels.find((l) => l.peak.peak.name === 'Pres');
    const loin = labels.find((l) => l.peak.peak.name === 'Loin');
    expect(pres!.y).toBeCloseTo(400 - 10 - 20, 9);
    expect(loin!.y).toBeLessThan(pres!.y);
  });

  it('accepte un ordre de priorite personnalise', () => {
    const peaks = [projected('Loin', 200, 400, 20_000), projected('Pres', 200, 400, 2000)];
    const farthestFirst = layoutLabels(peaks, VIEWPORT, {
      ...OPTIONS,
      priority: (a, b) => b.distance - a.distance,
    });
    const naturalY = 400 - 10 - 20;
    // La priorite inverse donne la place naturelle au sommet le plus lointain.
    expect(farthestFirst.find((l) => l.peak.peak.name === 'Loin')!.y).toBeCloseTo(naturalY, 9);
    expect(farthestFirst.find((l) => l.peak.peak.name === 'Pres')!.y).toBeLessThan(naturalY);
  });

  it('ne laisse pas une etiquette deborder du viewport', () => {
    const labels = layoutLabels(
      [projected('Bord gauche', 5, 400, 1000), projected('Bord droit', 395, 400, 2000)],
      VIEWPORT,
      OPTIONS,
    );
    for (const label of labels) {
      expect(label.x).toBeGreaterThanOrEqual(0);
      expect(label.x + label.width).toBeLessThanOrEqual(VIEWPORT.width);
    }
  });

  it('abandonne les etiquettes qui n ont plus de place vers le haut', () => {
    const crowded = Array.from({ length: 20 }, (_, i) => projected(`P${i}`, 200, 60, i * 100 + 100));
    const labels = layoutLabels(crowded, VIEWPORT, OPTIONS);
    expect(labels.length).toBeGreaterThan(0);
    expect(labels.length).toBeLessThan(crowded.length);
    for (const label of labels) {
      expect(label.y).toBeGreaterThanOrEqual(0);
    }
  });

  it('accepte une largeur dependant du sommet', () => {
    const labels = layoutLabels([projected('Pic long', 200, 400, 1000)], VIEWPORT, {
      ...OPTIONS,
      labelWidth: (peak) => peak.peak.name.length * 8,
    });
    expect(labels[0]!.width).toBe('Pic long'.length * 8);
  });

  it('renvoie une liste vide sans sommet', () => {
    expect(layoutLabels([], VIEWPORT, OPTIONS)).toEqual([]);
  });
});
