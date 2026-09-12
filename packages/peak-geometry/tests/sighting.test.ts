import { describe, expect, it } from 'vitest';
import { computeSighting, computeSightings } from '../src/sighting';
import { BALAITOUS, LARUNS, PIC_DANIE, PIC_DU_MIDI_DOSSAU } from './fixtures';

const ALL = [BALAITOUS, PIC_DANIE, PIC_DU_MIDI_DOSSAU];

describe('computeSighting', () => {
  it('assemble distance, gisement et elevation', () => {
    const sighting = computeSighting(LARUNS, PIC_DU_MIDI_DOSSAU);
    expect(sighting.peak).toBe(PIC_DU_MIDI_DOSSAU);
    expect(sighting.distance).toBeCloseTo(16_180.7301, 2);
    expect(sighting.bearing).toBeCloseTo(183.784679, 5);
    expect(sighting.elevationAngle).toBeCloseTo(8.239698, 5);
  });

  it('laisse la visibilite indeterminee tant qu aucun MNT n a tranche', () => {
    expect(computeSighting(LARUNS, PIC_DU_MIDI_DOSSAU).visibility).toBe('unknown');
  });

  it('accepte un statut de visibilite impose', () => {
    expect(computeSighting(LARUNS, PIC_DU_MIDI_DOSSAU, 'occluded').visibility).toBe('occluded');
  });
});

describe('computeSightings', () => {
  it('trie du plus proche au plus lointain', () => {
    const sightings = computeSightings(LARUNS, ALL, { maxDistance: 50_000 });
    expect(sightings.map((s) => s.peak.name)).toEqual([
      "Pic du Midi d'Ossau",
      'Balaitous',
      "Pic d'Anie",
    ]);
  });

  it('ecarte les sommets au-dela du rayon', () => {
    const sightings = computeSightings(LARUNS, ALL, { maxDistance: 20_000 });
    expect(sightings.map((s) => s.peak.name)).toEqual(["Pic du Midi d'Ossau", 'Balaitous']);
  });

  it('ecarte le sommet sur lequel on se tient', () => {
    const onTheSummit = { ...PIC_DU_MIDI_DOSSAU };
    const sightings = computeSightings(onTheSummit, ALL, {
      maxDistance: 50_000,
      minDistance: 100,
    });
    expect(sightings.map((s) => s.peak.name)).not.toContain("Pic du Midi d'Ossau");
  });

  it('renvoie une liste vide si rien n est a portee', () => {
    expect(computeSightings(LARUNS, ALL, { maxDistance: 1000 })).toEqual([]);
  });
});
