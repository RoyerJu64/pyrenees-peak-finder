import { describe, expect, it } from 'vitest';
import type { CameraFieldOfView, DeviceOrientation, PeakSighting, Viewport } from '@ppf/shared-types';
import { cameraBasis, projectSighting, projectSightings } from '../src/projection';
import { dot, length } from '../src/vector';
import { computeSighting } from '../src/sighting';
import { LARUNS, PIC_DU_MIDI_DOSSAU, makePeak } from './fixtures';

const VIEWPORT: Viewport = { width: 400, height: 800 };
const FOV: CameraFieldOfView = { horizontal: 60, vertical: 45 };

function orientation(heading: number, pitch = 0, roll = 0): DeviceOrientation {
  return { heading, pitch, roll };
}

function sighting(bearing: number, elevationAngle: number): PeakSighting {
  return {
    peak: makePeak({ latitude: 0, longitude: 0, altitude: 0 }),
    distance: 10_000,
    bearing,
    elevationAngle,
    visibility: 'unknown',
  };
}

describe('cameraBasis', () => {
  it('produit un triedre orthonorme', () => {
    for (const o of [orientation(0), orientation(137, 20, 35), orientation(280, -15, -70)]) {
      const basis = cameraBasis(o);
      expect(length(basis.forward)).toBeCloseTo(1, 9);
      expect(length(basis.right)).toBeCloseTo(1, 9);
      expect(length(basis.up)).toBeCloseTo(1, 9);
      expect(dot(basis.forward, basis.right)).toBeCloseTo(0, 9);
      expect(dot(basis.forward, basis.up)).toBeCloseTo(0, 9);
      expect(dot(basis.right, basis.up)).toBeCloseTo(0, 9);
    }
  });

  it('oriente le repere vers le nord, la droite a l est, le haut au zenith', () => {
    const basis = cameraBasis(orientation(0));
    expect(basis.forward.north).toBeCloseTo(1, 9);
    expect(basis.right.east).toBeCloseTo(1, 9);
    expect(basis.up.up).toBeCloseTo(1, 9);
  });
});

describe('projectSighting', () => {
  it('place au centre exact un sommet aligne avec l axe optique', () => {
    const result = projectSighting(sighting(120, 10), orientation(120, 10), FOV, VIEWPORT);
    expect(result).not.toBeNull();
    expect(result!.x).toBeCloseTo(VIEWPORT.width / 2, 9);
    expect(result!.y).toBeCloseTo(VIEWPORT.height / 2, 9);
    expect(result!.angularOffset).toBeLessThan(1e-6);
  });

  it('place a droite un sommet a droite du cap, a gauche sinon', () => {
    const right = projectSighting(sighting(30, 0), orientation(10), FOV, VIEWPORT);
    const left = projectSighting(sighting(350, 0), orientation(10), FOV, VIEWPORT);
    expect(right!.x).toBeGreaterThan(VIEWPORT.width / 2);
    expect(left!.x).toBeLessThan(VIEWPORT.width / 2);
  });

  it('place vers le haut de l image un sommet au-dessus de l axe optique', () => {
    const above = projectSighting(sighting(0, 12), orientation(0, 0), FOV, VIEWPORT);
    expect(above!.y).toBeLessThan(VIEWPORT.height / 2);
  });

  it('place le bord du champ sur le bord du viewport', () => {
    const edge = projectSighting(sighting(FOV.horizontal / 2, 0), orientation(0), FOV, VIEWPORT);
    expect(edge!.x).toBeCloseTo(VIEWPORT.width, 6);
  });

  it('ecarte un sommet hors du champ', () => {
    expect(projectSighting(sighting(45, 0), orientation(0), FOV, VIEWPORT)).toBeNull();
  });

  it('ecarte un sommet dans le dos de l observateur', () => {
    expect(projectSighting(sighting(180, 0), orientation(0), FOV, VIEWPORT)).toBeNull();
  });

  it('retient un sommet juste hors cadre quand une marge est demandee', () => {
    const justOutside = sighting(31.5, 0);
    expect(projectSighting(justOutside, orientation(0), FOV, VIEWPORT)).toBeNull();
    expect(projectSighting(justOutside, orientation(0), FOV, VIEWPORT, { overscan: 60 })).not.toBeNull();
  });

  it('projette de maniere rectilineaire, pas lineairement en angle', () => {
    // Une regle de trois angle -> pixels placerait le sommet a mi-demi-cadre.
    // Le modele stenope le ramene vers le centre : tan(15) / tan(30) = 0.464.
    const half = projectSighting(sighting(FOV.horizontal / 4, 0), orientation(0), FOV, VIEWPORT);
    const naiveX = VIEWPORT.width / 2 + VIEWPORT.width / 4;
    expect(half!.x).toBeLessThan(naiveX);
    const ratio = (half!.x - VIEWPORT.width / 2) / (VIEWPORT.width / 2);
    expect(ratio).toBeCloseTo(Math.tan(Math.PI / 12) / Math.tan(Math.PI / 6), 9);
  });

  it('fait tourner l image avec le roulis', () => {
    const upright = projectSighting(sighting(10, 0), orientation(0, 0, 0), FOV, VIEWPORT);
    const rolled = projectSighting(sighting(10, 0), orientation(0, 0, 90), FOV, VIEWPORT);
    expect(upright!.y).toBeCloseTo(VIEWPORT.height / 2, 6);
    // A 90 degres de roulis, un ecart de cap se lit sur l axe vertical de l image.
    expect(Math.abs(rolled!.y - VIEWPORT.height / 2)).toBeGreaterThan(1);
    expect(rolled!.x).toBeCloseTo(VIEWPORT.width / 2, 6);
  });

  it('donne un ecart angulaire egal a l ecart de cap dans le plan horizontal', () => {
    const result = projectSighting(sighting(20, 0), orientation(0, 0), FOV, VIEWPORT);
    expect(result!.angularOffset).toBeCloseTo(20, 6);
  });

  it('conserve les champs de la visee', () => {
    const source = computeSighting(LARUNS, PIC_DU_MIDI_DOSSAU);
    const result = projectSighting(source, orientation(source.bearing, source.elevationAngle), FOV, VIEWPORT);
    expect(result!.peak).toBe(PIC_DU_MIDI_DOSSAU);
    expect(result!.distance).toBe(source.distance);
    expect(result!.bearing).toBe(source.bearing);
  });
});

describe('projectSightings', () => {
  it('ne garde que les sommets dans le cadre', () => {
    const results = projectSightings(
      [sighting(0, 0), sighting(45, 0), sighting(180, 0), sighting(10, 5)],
      orientation(0),
      FOV,
      VIEWPORT,
    );
    expect(results).toHaveLength(2);
  });
});
