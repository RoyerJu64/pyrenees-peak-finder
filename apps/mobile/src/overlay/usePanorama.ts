import { useEffect, useMemo, useState } from 'react';
import { useSQLiteContext } from 'expo-sqlite';
import type {
  CameraFieldOfView,
  DeviceOrientation,
  ObserverPosition,
  PeakSighting,
  Viewport,
} from '@ppf/shared-types';
import {
  compareByRelevance,
  computeSightings,
  layoutLabels,
  markPeakOcclusion,
  projectSightings,
  rankByRelevance,
  type PlacedLabel,
} from '@ppf/peak-geometry';
import { loadPeaksAround } from '../peaks/database';
import { LABEL_HEIGHT, estimateLabelWidth } from '../ui/theme';

/** Portee de l'overlay, en metres. Au-dela, la brume l'emporte sur la geometrie. */
export const HORIZON_RADIUS_M = 45_000;

/** Ecarte le sommet sur lequel l'utilisateur se tient : son gisement n'a pas de sens. */
const MIN_DISTANCE_M = 150;

/**
 * Pas d'arrondi de la position, en degres, avant de relancer la requete et le
 * calcul d'occlusion. Environ 11 m : en deca, rien de visible ne change dans un
 * panorama, et recalculer a chaque salve du GPS ferait clignoter l'overlay.
 */
const POSITION_QUANTUM_DEG = 0.0001;

const quantize = (value: number): number =>
  Math.round(value / POSITION_QUANTUM_DEG) * POSITION_QUANTUM_DEG;

export interface Panorama {
  readonly labels: readonly PlacedLabel[];
  /** Visees retenues, cachees ecartees, triees par pertinence. */
  readonly sightings: readonly PeakSighting[];
  readonly occludedCount: number;
  readonly isLoading: boolean;
}

/**
 * Assemble la chaine geometrique complete, en deux etages de cout tres inegal.
 *
 * Requete spatiale, visees et occlusion ne dependent que de la position : ils
 * sont recalcules quand l'utilisateur se deplace de plus d'une dizaine de
 * metres. Projection et mise en page dependent de l'orientation : ils tournent
 * a chaque image. Melanger les deux ferait ressortir la requete SQLite a chaque
 * frisson de la main.
 */
export function usePanorama(
  position: ObserverPosition | null,
  orientation: DeviceOrientation | null,
  fieldOfView: CameraFieldOfView,
  viewport: Viewport,
): Panorama {
  const database = useSQLiteContext();
  const [sightings, setSightings] = useState<readonly PeakSighting[]>([]);
  const [occludedCount, setOccludedCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const anchor = useMemo(() => {
    if (position === null) {
      return null;
    }
    return {
      latitude: quantize(position.latitude),
      longitude: quantize(position.longitude),
      altitude: Math.round(position.altitude),
    };
  }, [position]);

  useEffect(() => {
    if (anchor === null) {
      return;
    }
    let cancelled = false;

    void (async () => {
      const peaks = await loadPeaksAround(database, anchor, HORIZON_RADIUS_M);
      if (cancelled) {
        return;
      }

      const visible = markPeakOcclusion(
        computeSightings(anchor, peaks, {
          maxDistance: HORIZON_RADIUS_M,
          minDistance: MIN_DISTANCE_M,
        }),
      );
      setOccludedCount(visible.filter((s) => s.visibility === 'occluded').length);
      setSightings(rankByRelevance(visible));
      setIsLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [database, anchor]);

  const labels = useMemo(() => {
    if (orientation === null || sightings.length === 0) {
      return [];
    }
    const projected = projectSightings(sightings, orientation, fieldOfView, viewport, {
      // Garder les sommets juste hors cadre evite que leur etiquette
      // n'apparaisse et ne disparaisse au moindre tremblement.
      overscan: 48,
    });
    return layoutLabels(projected, viewport, {
      labelWidth: (peak) => estimateLabelWidth(peak.peak.name),
      labelHeight: LABEL_HEIGHT,
      gap: 6,
      anchorOffset: 14,
      priority: compareByRelevance,
    });
  }, [sightings, orientation, fieldOfView, viewport]);

  return { labels, sightings, occludedCount, isLoading };
}
