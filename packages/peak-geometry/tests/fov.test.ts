import { describe, expect, it } from 'vitest';
import {
  FALLBACK_FIELD_OF_VIEW,
  cameraFieldOfView,
  cropFieldOfView,
  fieldOfViewFromFocalLength35mm,
} from '../src/fov';

const toDeg = (rad: number) => (rad * 180) / Math.PI;

describe('fieldOfViewFromFocalLength35mm', () => {
  it('retrouve les valeurs manuelles classiques du 50 mm en 3:2', () => {
    // Reference independante : sur un format 24x36, un 50 mm couvre
    // 2 * atan(18 / 50) horizontalement et 2 * atan(12 / 50) verticalement.
    const fov = fieldOfViewFromFocalLength35mm(50, 3 / 2);
    expect(fov.horizontal).toBeCloseTo(toDeg(2 * Math.atan(18 / 50)), 9);
    expect(fov.vertical).toBeCloseTo(toDeg(2 * Math.atan(12 / 50)), 9);
    expect(fov.horizontal).toBeCloseTo(39.5978, 3);
    expect(fov.vertical).toBeCloseTo(26.9915, 3);
  });

  it('retrouve les valeurs manuelles du 35 mm en 3:2', () => {
    const fov = fieldOfViewFromFocalLength35mm(35, 3 / 2);
    expect(fov.horizontal).toBeCloseTo(toDeg(2 * Math.atan(18 / 35)), 9);
    expect(fov.vertical).toBeCloseTo(toDeg(2 * Math.atan(12 / 35)), 9);
  });

  it('conserve la diagonale quel que soit le rapport de forme', () => {
    const diagonal = (aspect: number) => {
      const fov = fieldOfViewFromFocalLength35mm(28, aspect);
      const h = Math.tan((fov.horizontal / 2) * (Math.PI / 180));
      const v = Math.tan((fov.vertical / 2) * (Math.PI / 180));
      return toDeg(2 * Math.atan(Math.hypot(h, v)));
    };
    expect(diagonal(4 / 3)).toBeCloseTo(diagonal(3 / 2), 9);
    expect(diagonal(4 / 3)).toBeCloseTo(diagonal(16 / 9), 9);
  });

  it('respecte le rapport de forme demande', () => {
    const fov = fieldOfViewFromFocalLength35mm(26, 4 / 3);
    const h = Math.tan((fov.horizontal / 2) * (Math.PI / 180));
    const v = Math.tan((fov.vertical / 2) * (Math.PI / 180));
    expect(h / v).toBeCloseTo(4 / 3, 9);
  });

  it('ouvre le champ quand la focale raccourcit', () => {
    const large = fieldOfViewFromFocalLength35mm(13, 4 / 3);
    const standard = fieldOfViewFromFocalLength35mm(26, 4 / 3);
    const tele = fieldOfViewFromFocalLength35mm(77, 4 / 3);
    expect(large.horizontal).toBeGreaterThan(standard.horizontal);
    expect(standard.horizontal).toBeGreaterThan(tele.horizontal);
  });

  it('refuse une focale ou un rapport de forme non positifs', () => {
    expect(() => fieldOfViewFromFocalLength35mm(0, 4 / 3)).toThrow(RangeError);
    expect(() => fieldOfViewFromFocalLength35mm(26, 0)).toThrow(RangeError);
    expect(() => fieldOfViewFromFocalLength35mm(-26, 4 / 3)).toThrow(RangeError);
  });
});

describe('FALLBACK_FIELD_OF_VIEW', () => {
  it('correspond a un 26 mm equivalent en 4:3', () => {
    expect(FALLBACK_FIELD_OF_VIEW.horizontal).toBeCloseTo(67.2987, 3);
    expect(FALLBACK_FIELD_OF_VIEW.vertical).toBeCloseTo(53.0595, 3);
  });
});

describe('cropFieldOfView', () => {
  const source = fieldOfViewFromFocalLength35mm(26, 4 / 3);

  it('ne touche a rien quand le rapport de forme est deja le bon', () => {
    const cropped = cropFieldOfView(source, 4 / 3);
    expect(cropped.horizontal).toBeCloseTo(source.horizontal, 9);
    expect(cropped.vertical).toBeCloseTo(source.vertical, 9);
  });

  it('rogne la largeur pour un ecran de telephone en portrait', () => {
    // 9:19.5, format courant : bien plus etroit que le 4:3 du capteur.
    const cropped = cropFieldOfView(source, 9 / 19.5);
    expect(cropped.vertical).toBeCloseTo(source.vertical, 9);
    expect(cropped.horizontal).toBeLessThan(source.horizontal);
  });

  it('rogne la hauteur pour un affichage plus large que la source', () => {
    const cropped = cropFieldOfView(source, 21 / 9);
    expect(cropped.horizontal).toBeCloseTo(source.horizontal, 9);
    expect(cropped.vertical).toBeLessThan(source.vertical);
  });

  it('produit le rapport de forme demande', () => {
    for (const aspect of [9 / 19.5, 3 / 4, 1, 16 / 9]) {
      const cropped = cropFieldOfView(source, aspect);
      const h = Math.tan((cropped.horizontal / 2) * (Math.PI / 180));
      const v = Math.tan((cropped.vertical / 2) * (Math.PI / 180));
      expect(h / v).toBeCloseTo(aspect, 9);
    }
  });

  it('ne dilate jamais le champ', () => {
    for (const aspect of [9 / 19.5, 1, 16 / 9, 21 / 9]) {
      const cropped = cropFieldOfView(source, aspect);
      expect(cropped.horizontal).toBeLessThanOrEqual(source.horizontal + 1e-9);
      expect(cropped.vertical).toBeLessThanOrEqual(source.vertical + 1e-9);
    }
  });
});

describe('cameraFieldOfView', () => {
  const PORTRAIT = { width: 390, height: 844 };
  const LANDSCAPE = { width: 844, height: 390 };

  it('oriente le capteur selon le viewport', () => {
    const portrait = cameraFieldOfView(26, 4 / 3, PORTRAIT);
    const landscape = cameraFieldOfView(26, 4 / 3, LANDSCAPE);
    // Le meme appareil tourne d'un quart de tour echange simplement les axes.
    expect(portrait.horizontal).toBeCloseTo(landscape.vertical, 9);
    expect(portrait.vertical).toBeCloseTo(landscape.horizontal, 9);
    expect(portrait.vertical).toBeGreaterThan(portrait.horizontal);
  });

  it('donne le meme resultat qu on decrive le capteur en 4:3 ou en 3:4', () => {
    const a = cameraFieldOfView(26, 4 / 3, PORTRAIT);
    const b = cameraFieldOfView(26, 3 / 4, PORTRAIT);
    expect(a.horizontal).toBeCloseTo(b.horizontal, 9);
    expect(a.vertical).toBeCloseTo(b.vertical, 9);
  });

  it('produit le rapport de forme du viewport', () => {
    const fov = cameraFieldOfView(26, 4 / 3, PORTRAIT);
    const h = Math.tan((fov.horizontal / 2) * (Math.PI / 180));
    const v = Math.tan((fov.vertical / 2) * (Math.PI / 180));
    expect(h / v).toBeCloseTo(PORTRAIT.width / PORTRAIT.height, 9);
  });

  it('rogne bien la largeur en portrait plein ecran, sans toucher la hauteur', () => {
    const sensor = fieldOfViewFromFocalLength35mm(26, 3 / 4);
    const fov = cameraFieldOfView(26, 4 / 3, PORTRAIT);
    expect(fov.vertical).toBeCloseTo(sensor.vertical, 9);
    expect(fov.horizontal).toBeLessThan(sensor.horizontal);
    expect(fov.horizontal).toBeCloseTo(34.2, 1);
  });

  it('refuse un viewport degenere', () => {
    expect(() => cameraFieldOfView(26, 4 / 3, { width: 0, height: 844 })).toThrow(RangeError);
    expect(() => cameraFieldOfView(26, 4 / 3, { width: 390, height: -1 })).toThrow(RangeError);
  });
});
