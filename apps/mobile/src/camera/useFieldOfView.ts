import { useCallback, useEffect, useRef, useState } from 'react';
import type { CameraView } from 'expo-camera';
import type { CameraFieldOfView, Viewport } from '@ppf/shared-types';
import { FALLBACK_FOCAL_LENGTH_35MM, cameraFieldOfView } from '@ppf/peak-geometry';
import {
  SETTING_FOCAL_LENGTH_35MM,
  readNumericSetting,
  writeSetting,
} from '../settings/store';

/**
 * Rapport de forme du capteur photo principal, grand cote sur petit cote.
 * Le 4:3 est le format natif de la quasi-totalite des capteurs de telephone.
 */
const SENSOR_ASPECT_RATIO = 4 / 3;

/** Bornes de vraisemblance d'une focale equivalente de telephone, en mm. */
const MIN_FOCAL_35MM = 8;
const MAX_FOCAL_35MM = 400;

export interface FieldOfViewState {
  readonly fieldOfView: CameraFieldOfView;
  /** Vrai tant que la valeur vient du repli et non d'une mesure de l'appareil. */
  readonly isFallback: boolean;
}

function readFocalLength(exif: unknown): number | null {
  if (typeof exif !== 'object' || exif === null) {
    return null;
  }
  const record = exif as Record<string, unknown>;
  const candidate = record['FocalLenIn35mmFilm'] ?? record['FocalLengthIn35mmFilm'];
  const value = typeof candidate === 'string' ? Number.parseFloat(candidate) : candidate;
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null;
  }
  return value >= MIN_FOCAL_35MM && value <= MAX_FOCAL_35MM ? value : null;
}

/**
 * Champ de vision reellement rendu a l'ecran.
 *
 * `expo-camera` n'expose pas le FOV. On le mesure une fois, en prenant une
 * photo silencieuse dont on ne garde que l'EXIF : `FocalLengthIn35mmFilm` y
 * figure sur la quasi-totalite des telephones. La valeur est ensuite conservee,
 * pour ne pas redeclencher l'obturateur a chaque lancement.
 *
 * Tant qu'aucune mesure n'a abouti, le repli s'applique — un FOV faux etale ou
 * comprime tout le panorama sans que rien ne le signale, d'ou `isFallback`,
 * qui permet a l'interface de le dire.
 */
export function useFieldOfView(
  cameraRef: React.RefObject<CameraView | null>,
  viewport: Viewport,
  isCameraReady: boolean,
): FieldOfViewState {
  const [focalLength, setFocalLength] = useState<number | null>(null);
  const hasMeasured = useRef(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const stored = await readNumericSetting(SETTING_FOCAL_LENGTH_35MM);
      if (!cancelled && stored !== null) {
        hasMeasured.current = true;
        setFocalLength(stored);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const measure = useCallback(async () => {
    const camera = cameraRef.current;
    if (camera === null || hasMeasured.current) {
      return;
    }
    hasMeasured.current = true;

    try {
      const picture = await camera.takePictureAsync({
        exif: true,
        quality: 0,
        shutterSound: false,
        skipProcessing: true,
      });
      const measured = readFocalLength(picture?.exif);
      if (measured !== null) {
        setFocalLength(measured);
        await writeSetting(SETTING_FOCAL_LENGTH_35MM, String(measured));
      }
    } catch {
      // L'EXIF peut manquer, ou la prise de vue echouer : le repli reste en
      // place et l'interface le signale. Rien d'autre a faire ici.
    }
  }, [cameraRef]);

  useEffect(() => {
    if (isCameraReady && !hasMeasured.current) {
      void measure();
    }
  }, [isCameraReady, measure]);

  // Le repli passe par la meme fonction que la mesure : c'est elle qui oriente
  // le capteur selon le viewport et applique le rognage de l'apercu.
  return {
    fieldOfView: cameraFieldOfView(
      focalLength ?? FALLBACK_FOCAL_LENGTH_35MM,
      SENSOR_ASPECT_RATIO,
      viewport,
    ),
    isFallback: focalLength === null,
  };
}
