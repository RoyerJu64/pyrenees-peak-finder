import { StyleSheet, View } from 'react-native';
import type { PlacedLabel } from '@ppf/peak-geometry';
import { PeakLabel } from '../ui/PeakLabel';

interface PeakOverlayProps {
  readonly labels: readonly PlacedLabel[];
  readonly onSelect: (label: PlacedLabel) => void;
}

/** Couche d'etiquettes posee sur l'apercu camera. */
export function PeakOverlay({ labels, onSelect }: PeakOverlayProps) {
  return (
    // `box-none` laisse passer les gestes vers la camera partout sauf sur les
    // etiquettes elles-memes, qui restent cliquables.
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      {labels.map((label) => (
        <PeakLabel key={label.peak.peak.id} label={label} onPress={onSelect} />
      ))}
    </View>
  );
}
