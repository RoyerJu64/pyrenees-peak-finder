import { describe, expect, it } from 'vitest';
import { haversineDistance } from '../src/distance';
import { EARTH_RADIUS_M } from '../src/constants';
import { BALAITOUS, LARUNS, PIC_DANIE, PIC_DU_MIDI_DOSSAU } from './fixtures';

describe('haversineDistance', () => {
  it('renvoie zero pour deux points confondus', () => {
    expect(haversineDistance(LARUNS, LARUNS)).toBe(0);
  });

  it('retrouve la longueur analytique d un degre de meridien', () => {
    const expected = (EARTH_RADIUS_M * Math.PI) / 180;
    expect(haversineDistance({ latitude: 0, longitude: 0 }, { latitude: 1, longitude: 0 })).toBeCloseTo(expected, 6);
  });

  it('retrouve la longueur analytique d un degre a l equateur', () => {
    const expected = (EARTH_RADIUS_M * Math.PI) / 180;
    expect(haversineDistance({ latitude: 0, longitude: 0 }, { latitude: 0, longitude: 1 })).toBeCloseTo(expected, 6);
  });

  it('mesure un quart de grand cercle entre pole et equateur', () => {
    const expected = (EARTH_RADIUS_M * Math.PI) / 2;
    expect(haversineDistance({ latitude: 0, longitude: 0 }, { latitude: 90, longitude: 0 })).toBeCloseTo(expected, 6);
  });

  it('est symetrique', () => {
    expect(haversineDistance(LARUNS, BALAITOUS)).toBeCloseTo(haversineDistance(BALAITOUS, LARUNS), 9);
  });

  it.each([
    [PIC_DU_MIDI_DOSSAU, 16_180.7301],
    [PIC_DANIE, 21_088.902],
    [BALAITOUS, 19_581.0881],
  ])('reproduit la reference depuis Laruns vers $name', (peak, expected) => {
    expect(haversineDistance(LARUNS, peak)).toBeCloseTo(expected, 2);
  });
});
