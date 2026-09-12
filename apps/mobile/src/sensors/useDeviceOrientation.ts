import { useEffect, useRef, useState } from 'react';
import { DeviceMotion } from 'expo-sensors';
import type { DeviceOrientation } from '@ppf/shared-types';
import { applyHeadingOffset, orientationFromDeviceRotation } from '@ppf/peak-geometry';

/** Periode d'echantillonnage, en millisecondes. 60 Hz suffit a suivre la main. */
const UPDATE_INTERVAL_MS = 1000 / 60;

/**
 * Constante de lissage exponentiel, entre 0 et 1. Plus elle est basse, plus
 * l'overlay est stable et plus il retarde sur le geste. 0.25 tient les
 * etiquettes tranquilles sans donner l'impression qu'elles collent a l'ecran.
 */
const SMOOTHING = 0.25;

export type OrientationState =
  | { readonly status: 'pending' }
  | { readonly status: 'unavailable' }
  | { readonly status: 'ready'; readonly orientation: DeviceOrientation };

/** Moyenne exponentielle d'un angle, en tenant compte du passage par 360. */
function smoothAngle(previous: number, next: number, factor: number): number {
  let delta = ((next - previous + 540) % 360) - 180;
  return previous + delta * factor;
}

/**
 * Orientation de l'axe optique, lissee.
 *
 * @param headingOffset correction de cap, en degres, appliquee apres le lissage.
 *   Elle rattrape la derive du magnetometre et, sur les plateformes dont
 *   l'attitude part d'un referentiel arbitraire, le decalage au nord. C'est le
 *   reglage que l'utilisateur ajuste a la main depuis l'ecran camera.
 */
export function useDeviceOrientation(headingOffset: number): OrientationState {
  const [state, setState] = useState<OrientationState>({ status: 'pending' });
  const smoothed = useRef<DeviceOrientation | null>(null);

  useEffect(() => {
    let subscription: ReturnType<typeof DeviceMotion.addListener> | undefined;
    let cancelled = false;

    void (async () => {
      const available = await DeviceMotion.isAvailableAsync();
      if (cancelled) {
        return;
      }
      if (!available) {
        setState({ status: 'unavailable' });
        return;
      }

      DeviceMotion.setUpdateInterval(UPDATE_INTERVAL_MS);
      subscription = DeviceMotion.addListener(({ rotation }) => {
        if (cancelled || rotation == null) {
          return;
        }

        const measured = orientationFromDeviceRotation(rotation);
        const previous = smoothed.current;
        smoothed.current =
          previous === null
            ? measured
            : {
                heading: smoothAngle(previous.heading, measured.heading, SMOOTHING),
                pitch: previous.pitch + (measured.pitch - previous.pitch) * SMOOTHING,
                roll: smoothAngle(previous.roll, measured.roll, SMOOTHING),
              };

        setState({ status: 'ready', orientation: smoothed.current });
      });
    })();

    return () => {
      cancelled = true;
      subscription?.remove();
    };
  }, []);

  if (state.status !== 'ready') {
    return state;
  }
  return { status: 'ready', orientation: applyHeadingOffset(state.orientation, headingOffset) };
}
