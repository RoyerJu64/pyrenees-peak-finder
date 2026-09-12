import type { ObserverPosition, Peak } from '@ppf/shared-types';

/**
 * Reperes reels des vallees d'Ossau et d'Aspe.
 * Les valeurs attendues dans les tests ont ete calculees independamment par la
 * loi des cosinus spheriques (cf. data/scripts/reference_values.py), pas par
 * l'implementation testee ici.
 */
export const LARUNS: ObserverPosition = {
  latitude: 42.9886,
  longitude: -0.4247,
  altitude: 523,
};

export function makePeak(overrides: Partial<Peak> & Pick<Peak, 'latitude' | 'longitude' | 'altitude'>): Peak {
  return {
    id: overrides.id ?? 'osm:node/0',
    name: overrides.name ?? 'Sommet',
    prominence: overrides.prominence ?? null,
    wikidataId: overrides.wikidataId ?? null,
    description: overrides.description ?? null,
    wikipediaUrl: overrides.wikipediaUrl ?? null,
    latitude: overrides.latitude,
    longitude: overrides.longitude,
    altitude: overrides.altitude,
  };
}

export const PIC_DU_MIDI_DOSSAU = makePeak({
  id: 'osm:node/1',
  name: "Pic du Midi d'Ossau",
  latitude: 42.8434,
  longitude: -0.4378,
  altitude: 2884,
});

export const PIC_DANIE = makePeak({
  id: 'osm:node/2',
  name: "Pic d'Anie",
  latitude: 42.9558,
  longitude: -0.68,
  altitude: 2504,
});

export const BALAITOUS = makePeak({
  id: 'osm:node/3',
  name: 'Balaitous',
  latitude: 42.8447,
  longitude: -0.2861,
  altitude: 3144,
});
