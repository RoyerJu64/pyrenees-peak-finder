import { describe, expect, it } from 'vitest';
import type { PeakSighting } from '@ppf/shared-types';
import { markPeakOcclusion } from '../src/visibility';
import { makePeak } from './fixtures';

function sighting(
  id: string,
  distance: number,
  bearing: number,
  elevationAngle: number,
): PeakSighting {
  return {
    peak: makePeak({ id, name: id, latitude: 0, longitude: 0, altitude: 0 }),
    distance,
    bearing,
    elevationAngle,
    visibility: 'unknown',
  };
}

const statusOf = (results: PeakSighting[], id: string) =>
  results.find((s) => s.peak.id === id)!.visibility;

describe('markPeakOcclusion', () => {
  it('masque un sommet lointain derriere un sommet proche et plus haut', () => {
    const results = markPeakOcclusion([
      sighting('proche', 5_000, 180, 12),
      sighting('lointain', 20_000, 180, 6),
    ]);
    expect(statusOf(results, 'proche')).toBe('unknown');
    expect(statusOf(results, 'lointain')).toBe('occluded');
  });

  it('laisse passer un sommet lointain qui domine le sommet proche', () => {
    const results = markPeakOcclusion([
      sighting('proche', 5_000, 180, 6),
      sighting('lointain', 20_000, 180, 12),
    ]);
    expect(statusOf(results, 'lointain')).toBe('unknown');
  });

  it('ne masque rien hors du secteur angulaire', () => {
    const results = markPeakOcclusion(
      [sighting('proche', 5_000, 180, 12), sighting('lointain', 20_000, 182, 6)],
      { angularRadius: 0.5 },
    );
    expect(statusOf(results, 'lointain')).toBe('unknown');
  });

  it('traite le passage par le nord comme n importe quel gisement', () => {
    const results = markPeakOcclusion(
      [sighting('proche', 5_000, 359.8, 12), sighting('lointain', 20_000, 0.1, 6)],
      { angularRadius: 0.5 },
    );
    expect(statusOf(results, 'lointain')).toBe('occluded');
  });

  it('respecte la marge d elevation', () => {
    const barelyHigher = [sighting('proche', 5_000, 180, 6.1), sighting('lointain', 20_000, 180, 6)];
    expect(statusOf(markPeakOcclusion(barelyHigher, { elevationMargin: 0.2 }), 'lointain')).toBe(
      'unknown',
    );
    expect(statusOf(markPeakOcclusion(barelyHigher, { elevationMargin: 0.05 }), 'lointain')).toBe(
      'occluded',
    );
  });

  it('propage l occlusion en chaine', () => {
    const results = markPeakOcclusion([
      sighting('a', 4_000, 180, 15),
      sighting('b', 10_000, 180, 9),
      sighting('c', 20_000, 180, 3),
    ]);
    expect(statusOf(results, 'a')).toBe('unknown');
    expect(statusOf(results, 'b')).toBe('occluded');
    expect(statusOf(results, 'c')).toBe('occluded');
  });

  it('conserve l ordre d entree', () => {
    const input = [
      sighting('loin', 20_000, 180, 6),
      sighting('moyen', 12_000, 90, 4),
      sighting('pres', 5_000, 180, 12),
    ];
    expect(markPeakOcclusion(input).map((s) => s.peak.id)).toEqual(['loin', 'moyen', 'pres']);
  });

  it('ne modifie pas les visees fournies', () => {
    const input = [sighting('proche', 5_000, 180, 12), sighting('lointain', 20_000, 180, 6)];
    markPeakOcclusion(input);
    expect(input.every((s) => s.visibility === 'unknown')).toBe(true);
  });

  it('renvoie la meme reference quand le statut ne change pas', () => {
    const input = [sighting('seul', 5_000, 180, 12)];
    expect(markPeakOcclusion(input)[0]).toBe(input[0]);
  });

  it('accepte une liste vide', () => {
    expect(markPeakOcclusion([])).toEqual([]);
  });
});
