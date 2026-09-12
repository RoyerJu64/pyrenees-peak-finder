import { describe, expect, it } from 'vitest';
import type { PeakSighting } from '@ppf/shared-types';
import { angularSeparation, selectSkylinePeaks } from '../src/skyline';
import { makePeak } from './fixtures';

function sighting(
  id: string,
  bearing: number,
  elevationAngle: number,
  options: { distance?: number; description?: string | null } = {},
): PeakSighting {
  return {
    peak: makePeak({
      id,
      name: id,
      latitude: 0,
      longitude: 0,
      altitude: 2000,
      description: options.description ?? null,
    }),
    distance: options.distance ?? 20_000,
    bearing,
    elevationAngle,
    visibility: 'unknown',
  };
}

const ids = (sightings: readonly PeakSighting[]) => sightings.map((s) => s.peak.id).sort();

describe('angularSeparation', () => {
  it('est nulle entre une visee et elle-meme', () => {
    const a = sighting('a', 180, 5);
    expect(angularSeparation(a, a)).toBeCloseTo(0, 12);
  });

  it('est symetrique', () => {
    const a = sighting('a', 180, 5);
    const b = sighting('b', 183, 7);
    expect(angularSeparation(a, b)).toBeCloseTo(angularSeparation(b, a), 12);
  });

  it('se reduit a l ecart de gisement sur l horizon', () => {
    expect(angularSeparation(sighting('a', 180, 0), sighting('b', 183, 0))).toBeCloseTo(3, 9);
  });

  it('se reduit a l ecart d elevation au meme gisement', () => {
    expect(angularSeparation(sighting('a', 180, 2), sighting('b', 180, 9))).toBeCloseTo(7, 9);
  });

  it('resserre les gisements quand on regarde haut', () => {
    const low = angularSeparation(sighting('a', 180, 0), sighting('b', 184, 0));
    const high = angularSeparation(sighting('a', 180, 60), sighting('b', 184, 60));
    expect(high).toBeLessThan(low);
  });

  it('traite le passage par le nord comme n importe quel gisement', () => {
    expect(angularSeparation(sighting('a', 359, 0), sighting('b', 1, 0))).toBeCloseTo(2, 9);
  });

  it('combine les deux axes', () => {
    // 3 degres de gisement et 4 d elevation : triangle 3-4-5.
    expect(angularSeparation(sighting('a', 180, 0), sighting('b', 183, 4))).toBeCloseTo(5, 1);
  });
});

describe('selectSkylinePeaks', () => {
  it('ne garde qu un sommet par silhouette', () => {
    const kept = selectSkylinePeaks(
      [
        sighting('crete-a', 180.0, 3.0),
        sighting('crete-b', 180.4, 2.9),
        sighting('crete-c', 180.8, 2.8),
      ],
      { minSeparation: 1.5 },
    );
    expect(kept).toHaveLength(1);
  });

  it('conserve les sommets nettement separes en gisement', () => {
    const kept = selectSkylinePeaks(
      [sighting('ouest', 170, 3), sighting('est', 190, 3)],
      { minSeparation: 1.5 },
    );
    expect(ids(kept)).toEqual(['est', 'ouest']);
  });

  it('conserve deux sommets au meme gisement mais a des hauteurs differentes', () => {
    // Un contrefort proche haut dans le cadre et un sommet lointain sur
    // l'horizon sont deux objets distincts, meme exactement alignes.
    const kept = selectSkylinePeaks(
      [sighting('contrefort', 180, 12), sighting('horizon', 180, 3)],
      { minSeparation: 1.5 },
    );
    expect(ids(kept)).toEqual(['contrefort', 'horizon']);
  });

  it('garde le sommet documente plutot que son jumeau anonyme', () => {
    // Regression : un seuil de depassement local eliminait les deux sommets
    // d'un massif jumele, chacun « dominant » l'autre de quelques centiemes de
    // degre. Le massif entier disparaissait. C'est le cas du Pic du Midi
    // d'Ossau, flanque de la Pointe de France, six metres plus bas.
    const kept = selectSkylinePeaks(
      [
        sighting('pointe-voisine', 186.4, 2.84),
        sighting('sommet-principal', 186.2, 2.85, { description: 'Sommet emblematique' }),
      ],
      { minSeparation: 1.5 },
    );
    expect(ids(kept)).toEqual(['sommet-principal']);
  });

  it('ne vide jamais un groupe', () => {
    const cluster = Array.from({ length: 12 }, (_, i) =>
      sighting(`p${i}`, 180 + i * 0.05, 3 - i * 0.001),
    );
    expect(selectSkylinePeaks(cluster, { minSeparation: 1.5 })).toHaveLength(1);
  });

  it('accepte un ordre de priorite personnalise', () => {
    // Les deux sommets doivent tomber dans le meme groupe pour que la
    // priorite departage : 0.92 degre de separation, sous le seuil de 1.5.
    const pair = [sighting('bas', 180, 2.0), sighting('haut', 180.2, 2.9)];

    expect(ids(selectSkylinePeaks(pair, { minSeparation: 1.5 }))).toEqual(['haut']);
    expect(
      ids(
        selectSkylinePeaks(pair, {
          minSeparation: 1.5,
          priority: (a, b) => a.elevationAngle - b.elevationAngle,
        }),
      ),
    ).toEqual(['bas']);
  });

  it('resserre le tri quand la separation demandee diminue', () => {
    const ridge = [
      sighting('a', 180, 3),
      sighting('b', 181, 2.9),
      sighting('c', 182, 2.8),
      sighting('d', 183, 2.7),
    ];
    expect(selectSkylinePeaks(ridge, { minSeparation: 2.5 }).length).toBeLessThan(
      selectSkylinePeaks(ridge, { minSeparation: 0.5 }).length,
    );
  });

  it('ne modifie pas la liste fournie', () => {
    const input = [sighting('b', 180, 2), sighting('a', 200, 9)];
    selectSkylinePeaks(input, { minSeparation: 1.5 });
    expect(input.map((s) => s.peak.id)).toEqual(['b', 'a']);
  });

  it('accepte une liste vide', () => {
    expect(selectSkylinePeaks([], { minSeparation: 1.5 })).toEqual([]);
  });
});
