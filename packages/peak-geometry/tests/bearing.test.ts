import { describe, expect, it } from 'vitest';
import { initialBearing } from '../src/bearing';
import { bearingDelta } from '../src/angles';
import { BALAITOUS, LARUNS, PIC_DANIE, PIC_DU_MIDI_DOSSAU } from './fixtures';

describe('initialBearing', () => {
  it('donne les quatre points cardinaux', () => {
    const origin = { latitude: 0, longitude: 0 };
    expect(initialBearing(origin, { latitude: 1, longitude: 0 })).toBeCloseTo(0, 9);
    expect(initialBearing(origin, { latitude: 0, longitude: 1 })).toBeCloseTo(90, 9);
    expect(initialBearing(origin, { latitude: -1, longitude: 0 })).toBeCloseTo(180, 9);
    expect(initialBearing(origin, { latitude: 0, longitude: -1 })).toBeCloseTo(270, 9);
  });

  it('reste dans [0, 360[', () => {
    const bearing = initialBearing(LARUNS, PIC_DANIE);
    expect(bearing).toBeGreaterThanOrEqual(0);
    expect(bearing).toBeLessThan(360);
  });

  it.each([
    [PIC_DU_MIDI_DOSSAU, 183.784679],
    [PIC_DANIE, 260.128],
    [BALAITOUS, 144.754721],
  ])('reproduit la reference depuis Laruns vers $name', (peak, expected) => {
    expect(initialBearing(LARUNS, peak)).toBeCloseTo(expected, 5);
  });

  it('situe le Pic du Midi d Ossau plein sud de Laruns', () => {
    expect(Math.abs(bearingDelta(180, initialBearing(LARUNS, PIC_DU_MIDI_DOSSAU)))).toBeLessThan(5);
  });

  it('a un gisement retour proche de l oppose sur une courte distance', () => {
    const forward = initialBearing(LARUNS, PIC_DU_MIDI_DOSSAU);
    const backward = initialBearing(PIC_DU_MIDI_DOSSAU, LARUNS);
    expect(Math.abs(bearingDelta(forward + 180, backward))).toBeLessThan(0.05);
  });
});
