import { describe, expect, it } from 'vitest';
import { applyHeadingOffset, orientationFromDeviceRotation } from '../src/deviceOrientation';
import { cameraBasis } from '../src/projection';
import { directionVector, dot } from '../src/vector';

const rad = (degrees: number) => (degrees * Math.PI) / 180;

/** Telephone tenu droit en portrait, camera arriere a l'horizontale. */
const upright = (alphaDeg: number, gammaDeg = 0) => ({
  alpha: rad(alphaDeg),
  beta: rad(90),
  gamma: rad(gammaDeg),
});

describe('orientationFromDeviceRotation', () => {
  it('vise le nord, a plat, quand alpha est nul et le telephone droit', () => {
    const orientation = orientationFromDeviceRotation(upright(0));
    expect(orientation.heading).toBeCloseTo(0, 6);
    expect(orientation.pitch).toBeCloseTo(0, 6);
    expect(orientation.roll).toBeCloseTo(0, 6);
  });

  it('fait tourner le cap dans le sens inverse d alpha', () => {
    // alpha tourne l'appareil, le cap vise tourne donc a l'oppose.
    expect(orientationFromDeviceRotation(upright(-90)).heading).toBeCloseTo(90, 6);
    expect(orientationFromDeviceRotation(upright(-180)).heading).toBeCloseTo(180, 6);
    expect(orientationFromDeviceRotation(upright(90)).heading).toBeCloseTo(270, 6);
  });

  it('vise le sol quand le telephone est pose a plat, ecran vers le ciel', () => {
    const orientation = orientationFromDeviceRotation({ alpha: 0, beta: 0, gamma: 0 });
    expect(orientation.pitch).toBeCloseTo(-90, 6);
  });

  it('vise le ciel quand le telephone est pose ecran contre la table', () => {
    const orientation = orientationFromDeviceRotation({ alpha: 0, beta: rad(180), gamma: 0 });
    expect(orientation.pitch).toBeCloseTo(90, 6);
  });

  it('leve l inclinaison quand on bascule le telephone vers le haut', () => {
    const orientation = orientationFromDeviceRotation({ alpha: 0, beta: rad(120), gamma: 0 });
    expect(orientation.pitch).toBeCloseTo(30, 6);
    expect(orientation.heading).toBeCloseTo(0, 6);
  });

  it('rend un quart de tour de roulis en paysage', () => {
    // Paysage, camera a l'horizontale : beta ramene a zero, gamma au quart de tour.
    const left = orientationFromDeviceRotation({ alpha: 0, beta: 0, gamma: rad(-90) });
    expect(left.pitch).toBeCloseTo(0, 6);
    expect(left.roll).toBeCloseTo(90, 6);
    expect(left.heading).toBeCloseTo(90, 6);

    const right = orientationFromDeviceRotation({ alpha: 0, beta: 0, gamma: rad(90) });
    expect(right.roll).toBeCloseTo(-90, 6);
    expect(right.heading).toBeCloseTo(270, 6);
  });

  it('perd gamma dans le cap quand le telephone est parfaitement droit', () => {
    // Blocage de cardan : a beta = 90 l'axe Y de l'appareil pointe au zenith,
    // donc alpha et gamma tournent tous deux autour de la verticale. Ce n'est
    // pas un defaut a corriger, c'est une propriete de la representation — et
    // c'est sans consequence, l'axe optique reste correctement vise.
    const orientation = orientationFromDeviceRotation(upright(0, 30));
    expect(orientation.heading).toBeCloseTo(330, 6);
    expect(orientation.roll).toBeCloseTo(0, 6);
    expect(orientation.pitch).toBeCloseTo(0, 6);
  });

  it('incline vers le bas quand on abaisse le telephone', () => {
    expect(orientationFromDeviceRotation({ alpha: 0, beta: rad(80), gamma: 0 }).pitch).toBeCloseTo(
      -10,
      6,
    );
  });

  it('reste dans les plages declarees', () => {
    for (let alpha = -180; alpha < 180; alpha += 23) {
      for (let beta = -180; beta <= 180; beta += 37) {
        for (let gamma = -90; gamma <= 90; gamma += 29) {
          const o = orientationFromDeviceRotation({
            alpha: rad(alpha),
            beta: rad(beta),
            gamma: rad(gamma),
          });
          expect(o.heading).toBeGreaterThanOrEqual(0);
          expect(o.heading).toBeLessThan(360);
          expect(o.pitch).toBeGreaterThanOrEqual(-90);
          expect(o.pitch).toBeLessThanOrEqual(90);
          expect(Number.isFinite(o.roll)).toBe(true);
        }
      }
    }
  });

  it("s'accorde avec cameraBasis sur l'axe optique", () => {
    // Le repere reconstruit par la projection doit viser exactement la ou
    // l'attitude du telephone dit qu'il vise. Sans cet accord, les etiquettes
    // se decalent sur un telephone incline.
    for (const rotation of [
      upright(0),
      upright(-45),
      upright(120, 25),
      { alpha: rad(30), beta: rad(110), gamma: rad(-40) },
      { alpha: rad(-150), beta: rad(60), gamma: rad(15) },
    ]) {
      const orientation = orientationFromDeviceRotation(rotation);
      const basis = cameraBasis(orientation);
      const expected = directionVector(orientation.heading, orientation.pitch);
      expect(dot(basis.forward, expected)).toBeCloseTo(1, 9);
    }
  });

  it("s'accorde avec cameraBasis sur le haut de l'ecran", () => {
    for (const rotation of [upright(0, 30), upright(-70, -50), { alpha: rad(10), beta: rad(70), gamma: rad(35) }]) {
      const orientation = orientationFromDeviceRotation(rotation);
      const basis = cameraBasis(orientation);

      const cosAlpha = Math.cos(rotation.alpha);
      const sinAlpha = Math.sin(rotation.alpha);
      const cosBeta = Math.cos(rotation.beta);
      const sinBeta = Math.sin(rotation.beta);
      const screenUp = {
        east: -sinAlpha * cosBeta,
        north: cosAlpha * cosBeta,
        up: sinBeta,
      };

      expect(dot(basis.up, screenUp)).toBeCloseTo(1, 9);
    }
  });
});

describe('applyHeadingOffset', () => {
  it('decale le cap et le ramene dans [0, 360[', () => {
    const base = { heading: 350, pitch: 5, roll: 2 };
    expect(applyHeadingOffset(base, 20).heading).toBeCloseTo(10, 9);
    expect(applyHeadingOffset(base, -360).heading).toBeCloseTo(350, 9);
  });

  it('ne touche ni a l inclinaison ni au roulis', () => {
    const base = { heading: 100, pitch: 7, roll: -3 };
    const shifted = applyHeadingOffset(base, 45);
    expect(shifted.pitch).toBe(7);
    expect(shifted.roll).toBe(-3);
  });
});
