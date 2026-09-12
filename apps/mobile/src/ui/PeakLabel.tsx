import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { PlacedLabel } from '@ppf/peak-geometry';
import { LABEL_HEIGHT, theme } from './theme';

interface PeakLabelProps {
  readonly label: PlacedLabel;
  readonly onPress: (label: PlacedLabel) => void;
}

const formatAltitude = (meters: number): string => `${Math.round(meters)} m`;

const formatDistance = (meters: number): string =>
  meters < 10_000
    ? `${(meters / 1000).toFixed(1)} km`
    : `${Math.round(meters / 1000)} km`;

/**
 * Etiquette d'un sommet, reliee par un filet au point vise.
 *
 * Le filet compte : les etiquettes sont remontees pour ne pas se recouvrir, et
 * sans rappel visuel rien ne dirait laquelle designe quel point de la crete.
 */
function PeakLabelComponent({ label, onPress }: PeakLabelProps) {
  const { peak } = label;
  const isDocumented = peak.peak.description !== null;

  // Le filet part du bas de l'etiquette et descend jusqu'au sommet, a l'aplomb
  // du point vise et non de l'etiquette, qui a pu etre decalee.
  const leaderTop = label.y + label.height;
  const leaderHeight = Math.max(0, peak.y - leaderTop);

  return (
    <>
      <View
        pointerEvents="none"
        style={[styles.leader, { left: peak.x, top: leaderTop, height: leaderHeight }]}
      />
      <View pointerEvents="none" style={[styles.marker, { left: peak.x - 4, top: peak.y - 1 }]} />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${peak.peak.name}, ${formatAltitude(peak.peak.altitude)}, a ${formatDistance(peak.distance)}`}
        onPress={() => onPress(label)}
        style={[styles.label, { left: label.x, top: label.y, width: label.width }]}
      >
        <View style={[styles.rule, isDocumented && styles.ruleDocumented]} />
        <View style={styles.text}>
          <Text numberOfLines={1} style={styles.name}>
            {peak.peak.name}
          </Text>
          <Text numberOfLines={1} style={styles.detail}>
            {formatAltitude(peak.peak.altitude)}
            <Text style={styles.separator}>{'   '}</Text>
            {formatDistance(peak.distance)}
          </Text>
        </View>
      </Pressable>
    </>
  );
}

const styles = StyleSheet.create({
  leader: {
    position: 'absolute',
    width: StyleSheet.hairlineWidth,
    backgroundColor: theme.color.leader,
  },
  marker: {
    position: 'absolute',
    width: 9,
    height: StyleSheet.hairlineWidth * 2,
    backgroundColor: theme.color.marker,
  },
  label: {
    position: 'absolute',
    height: LABEL_HEIGHT,
    flexDirection: 'row',
    alignItems: 'stretch',
    backgroundColor: theme.color.labelBacking,
  },
  // Un filet vertical plutot qu'une pastille : l'etiquette se lit comme une
  // annotation posee sur le paysage, pas comme un composant d'interface.
  rule: {
    width: 2,
    backgroundColor: theme.color.leader,
  },
  ruleDocumented: {
    backgroundColor: theme.color.accent,
  },
  text: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: theme.space(2),
  },
  name: {
    color: theme.color.label,
    fontFamily: theme.font.sans,
    fontSize: theme.size.label,
    fontWeight: '500',
    letterSpacing: -0.2,
  },
  detail: {
    color: theme.color.labelMuted,
    fontFamily: theme.font.numeric,
    fontSize: theme.size.labelDetail,
    fontVariant: ['tabular-nums'],
    letterSpacing: 0.3,
    marginTop: 1,
  },
  separator: {
    color: theme.color.textFaint,
  },
});

export const PeakLabel = memo(PeakLabelComponent);
