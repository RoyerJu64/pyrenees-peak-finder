import { describe, expect, it } from 'vitest';
import type { Peak, PeakSighting, VisibilityStatus } from '@ppf/shared-types';
import { apparentSize, compareByRelevance, rankByRelevance } from '../src/ranking';
import { makePeak } from './fixtures';

function sighting(
  id: string,
  options: {
    elevationAngle?: number;
    distance?: number;
    visibility?: VisibilityStatus;
    description?: string | null;
    prominence?: number | null;
  } = {},
): PeakSighting {
  const peak: Peak = makePeak({
    id,
    name: id,
    latitude: 0,
    longitude: 0,
    altitude: 2000,
    description: options.description ?? null,
    prominence: options.prominence ?? null,
  });
  return {
    peak,
    distance: options.distance ?? 10_000,
    bearing: 180,
    elevationAngle: options.elevationAngle ?? 5,
    visibility: options.visibility ?? 'unknown',
  };
}

const ids = (sightings: readonly PeakSighting[]) => sightings.map((s) => s.peak.id);

describe('apparentSize', () => {
  it('vaut l angle d elevation', () => {
    expect(apparentSize(sighting('a', { elevationAngle: 12.5 }))).toBeCloseTo(12.5, 9);
  });

  it('plancher a zero sous l horizon', () => {
    expect(apparentSize(sighting('a', { elevationAngle: -3 }))).toBe(0);
  });
});

describe('compareByRelevance', () => {
  it('place le visible devant l indetermine, et l indetermine devant le cache', () => {
    const ordered = [
      sighting('cache', { visibility: 'occluded' }),
      sighting('indetermine', { visibility: 'unknown' }),
      sighting('vu', { visibility: 'visible' }),
    ].sort(compareByRelevance);
    expect(ids(ordered)).toEqual(['vu', 'indetermine', 'cache']);
  });

  it('place le decrit devant le non decrit, a visibilite egale', () => {
    const ordered = [
      sighting('anonyme', { elevationAngle: 20 }),
      sighting('decrit', { elevationAngle: 4, description: 'Sommet emblematique' }),
    ].sort(compareByRelevance);
    expect(ids(ordered)).toEqual(['decrit', 'anonyme']);
  });

  it('trie par taille apparente decroissante a criteres egaux', () => {
    const ordered = [
      sighting('petit', { elevationAngle: 2 }),
      sighting('grand', { elevationAngle: 18 }),
      sighting('moyen', { elevationAngle: 9 }),
    ].sort(compareByRelevance);
    expect(ids(ordered)).toEqual(['grand', 'moyen', 'petit']);
  });

  it('fait passer la visibilite avant la description', () => {
    const ordered = [
      sighting('cache mais decrit', { visibility: 'occluded', description: 'texte' }),
      sighting('vu et anonyme', { visibility: 'visible' }),
    ].sort(compareByRelevance);
    expect(ids(ordered)).toEqual(['vu et anonyme', 'cache mais decrit']);
  });

  it('departage par proeminence puis par distance', () => {
    const byProminence = [
      sighting('plat', { elevationAngle: 7, prominence: 40 }),
      sighting('detache', { elevationAngle: 7, prominence: 800 }),
    ].sort(compareByRelevance);
    expect(ids(byProminence)).toEqual(['detache', 'plat']);

    const byDistance = [
      sighting('loin', { elevationAngle: 7, distance: 30_000 }),
      sighting('pres', { elevationAngle: 7, distance: 4_000 }),
    ].sort(compareByRelevance);
    expect(ids(byDistance)).toEqual(['pres', 'loin']);
  });

  it('donne un ordre total et stable, sans ex aequo', () => {
    const identical = ['c', 'a', 'b'].map((id) => sighting(id));
    expect(ids([...identical].sort(compareByRelevance))).toEqual(['a', 'b', 'c']);
    expect(ids([...identical].reverse().sort(compareByRelevance))).toEqual(['a', 'b', 'c']);
  });
});

describe('rankByRelevance', () => {
  it('ecarte les sommets caches par defaut', () => {
    const ranked = rankByRelevance([
      sighting('cache', { visibility: 'occluded' }),
      sighting('vu', { visibility: 'visible' }),
    ]);
    expect(ids(ranked)).toEqual(['vu']);
  });

  it('peut conserver les sommets caches', () => {
    const ranked = rankByRelevance(
      [sighting('cache', { visibility: 'occluded' }), sighting('vu', { visibility: 'visible' })],
      { excludeOccluded: false },
    );
    expect(ids(ranked)).toEqual(['vu', 'cache']);
  });

  it('peut exiger une visibilite tranchee', () => {
    const input = [
      sighting('indetermine', { visibility: 'unknown' }),
      sighting('vu', { visibility: 'visible' }),
    ];
    expect(ids(rankByRelevance(input))).toEqual(['vu', 'indetermine']);
    expect(ids(rankByRelevance(input, { requireKnownVisibility: true }))).toEqual(['vu']);
  });

  it('tronque au nombre demande', () => {
    const ranked = rankByRelevance(
      [
        sighting('a', { elevationAngle: 1 }),
        sighting('b', { elevationAngle: 2 }),
        sighting('c', { elevationAngle: 3 }),
      ],
      { limit: 2 },
    );
    expect(ids(ranked)).toEqual(['c', 'b']);
  });

  it('ne modifie pas la liste fournie', () => {
    const input = [sighting('b', { elevationAngle: 1 }), sighting('a', { elevationAngle: 9 })];
    rankByRelevance(input);
    expect(ids(input)).toEqual(['b', 'a']);
  });

  it('accepte une liste vide', () => {
    expect(rankByRelevance([])).toEqual([]);
  });
});
