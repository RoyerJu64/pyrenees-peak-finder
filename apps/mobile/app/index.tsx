import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { PeakSighting, Viewport } from '@ppf/shared-types';
import type { PlacedLabel } from '@ppf/peak-geometry';
import { useFieldOfView } from '../src/camera/useFieldOfView';
import { PeakOverlay } from '../src/overlay/PeakOverlay';
import { usePanorama } from '../src/overlay/usePanorama';
import { useDeviceOrientation } from '../src/sensors/useDeviceOrientation';
import { useObserverPosition } from '../src/sensors/useObserverPosition';
import {
  SETTING_HEADING_OFFSET,
  readNumericSetting,
  writeSetting,
} from '../src/settings/store';
import { CompassStrip } from '../src/ui/CompassStrip';
import { PeakSheet } from '../src/ui/PeakSheet';
import { StatusScreen } from '../src/ui/StatusScreen';
import { theme } from '../src/ui/theme';

export default function CameraScreen() {
  const insets = useSafeAreaInsets();
  const cameraRef = useRef<CameraView | null>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [viewport, setViewport] = useState<Viewport | null>(null);
  const [isCameraReady, setCameraReady] = useState(false);
  const [selected, setSelected] = useState<PeakSighting | null>(null);
  const [headingOffset, setHeadingOffset] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const stored = await readNumericSetting(SETTING_HEADING_OFFSET);
      if (!cancelled && stored !== null) {
        setHeadingOffset(stored);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const persistOffset = useCallback((value: number) => {
    void writeSetting(SETTING_HEADING_OFFSET, value.toFixed(2));
  }, []);

  const adjustHeading = useCallback(
    (delta: number) => {
      setHeadingOffset((previous) => {
        const next = previous + delta;
        persistOffset(next);
        return next;
      });
    },
    [persistOffset],
  );

  const resetHeading = useCallback(() => {
    setHeadingOffset(0);
    persistOffset(0);
  }, [persistOffset]);

  const onLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setViewport({ width, height });
  }, []);

  const position = useObserverPosition();
  const orientation = useDeviceOrientation(headingOffset);
  const measuredViewport = viewport ?? { width: 1, height: 1 };
  const { fieldOfView, isFallback } = useFieldOfView(cameraRef, measuredViewport, isCameraReady);
  const panorama = usePanorama(
    position.status === 'ready' ? position.position : null,
    orientation.status === 'ready' ? orientation.orientation : null,
    fieldOfView,
    measuredViewport,
  );

  const onSelect = useCallback((label: PlacedLabel) => {
    setSelected(label.peak);
  }, []);

  if (permission === null) {
    return <StatusScreen title="Camera" message="Verification de l'autorisation." />;
  }
  if (!permission.granted) {
    return (
      <StatusScreen
        title="Acces a la camera"
        message="L'application superpose les noms des sommets a l'image de la camera. Sans cet acces, elle n'a rien a annoter."
        action={{ label: "Autoriser l'acces", onPress: () => void requestPermission() }}
      />
    );
  }
  if (position.status === 'denied') {
    return (
      <StatusScreen
        title="Acces a la position"
        message="Identifier un sommet demande de savoir d'ou on le regarde. La position reste sur l'appareil : l'application ne communique avec aucun serveur."
      />
    );
  }
  if (position.status === 'unavailable') {
    return <StatusScreen title="Position indisponible" message={position.reason} />;
  }
  if (orientation.status === 'unavailable') {
    return (
      <StatusScreen
        title="Capteurs indisponibles"
        message="Cet appareil ne fournit pas d'orientation. Sans magnetometre ni accelerometre, impossible de savoir ou pointe la camera."
      />
    );
  }

  return (
    <View style={styles.container} onLayout={onLayout}>
      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        facing="back"
        onCameraReady={() => setCameraReady(true)}
      />

      {viewport !== null ? <PeakOverlay labels={panorama.labels} onSelect={onSelect} /> : null}

      <View pointerEvents="none" style={[styles.status, { top: insets.top + theme.space(2) }]}>
        <Text style={styles.statusText}>{statusLine(position, panorama)}</Text>
        {isFallback ? (
          <Text style={styles.warning}>
            Champ de vision estime — mesure de l'objectif en attente
          </Text>
        ) : null}
      </View>

      <View style={[styles.compass, { paddingBottom: insets.bottom }]}>
        {viewport !== null && orientation.status === 'ready' ? (
          <CompassStrip
            heading={orientation.orientation.heading}
            headingOffset={headingOffset}
            width={viewport.width}
            horizontalFov={fieldOfView.horizontal}
            onAdjust={adjustHeading}
            onReset={resetHeading}
          />
        ) : null}
      </View>

      <PeakSheet sighting={selected} onClose={() => setSelected(null)} />
    </View>
  );
}

function statusLine(
  position: ReturnType<typeof useObserverPosition>,
  panorama: ReturnType<typeof usePanorama>,
): string {
  if (position.status !== 'ready') {
    return 'Recherche de la position';
  }
  if (panorama.isLoading) {
    return 'Lecture des sommets';
  }
  const altitude = `${Math.round(position.position.altitude)} m`;
  return `${altitude}  ·  ${panorama.sightings.length} sommets  ·  ${panorama.occludedCount} masques`;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.color.screen,
  },
  status: {
    position: 'absolute',
    left: theme.space(4),
    right: theme.space(4),
  },
  statusText: {
    color: theme.color.labelMuted,
    fontFamily: theme.font.numeric,
    fontSize: theme.size.caption,
    fontVariant: ['tabular-nums'],
    letterSpacing: 0.4,
  },
  warning: {
    color: theme.color.accent,
    fontFamily: theme.font.sans,
    fontSize: theme.size.caption,
    marginTop: 2,
  },
  compass: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
});
