import { Linking, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { PeakSighting } from '@ppf/shared-types';
import { theme } from './theme';

interface PeakSheetProps {
  readonly sighting: PeakSighting | null;
  readonly onClose: () => void;
}

const CARDINALS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
  'S', 'SSO', 'SO', 'OSO', 'O', 'ONO', 'NO', 'NNO'] as const;

function cardinal(bearing: number): string {
  const index = Math.round(bearing / 22.5) % 16;
  return CARDINALS[index] ?? 'N';
}

function Field({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{value}</Text>
    </View>
  );
}

/** Fiche d'un sommet : ce que l'utilisateur a demande en visant. */
export function PeakSheet({ sighting, onClose }: PeakSheetProps) {
  if (sighting === null) {
    return null;
  }
  const { peak } = sighting;

  return (
    <Modal animationType="slide" transparent onRequestClose={onClose} visible>
      <Pressable accessibilityRole="button" onPress={onClose} style={styles.backdrop} />
      <View style={styles.sheet}>
        <View style={styles.handle} />
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.name}>{peak.name}</Text>

          <View style={styles.fields}>
            <Field label="Altitude" value={`${Math.round(peak.altitude)} m`} />
            <Field label="Distance" value={`${(sighting.distance / 1000).toFixed(1)} km`} />
            <Field
              label="Gisement"
              value={`${Math.round(sighting.bearing)}° ${cardinal(sighting.bearing)}`}
            />
            <Field label="Elevation" value={`${sighting.elevationAngle.toFixed(1)}°`} />
            {peak.prominence !== null ? (
              <Field label="Proeminence" value={`${Math.round(peak.prominence)} m`} />
            ) : null}
          </View>

          {peak.description !== null ? (
            <Text style={styles.description}>{peak.description}</Text>
          ) : (
            <Text style={styles.missing}>
              Aucune description pour ce sommet. OpenStreetMap et Wikipedia ne couvrent
              qu'une fraction des sommets secondaires.
            </Text>
          )}

          {peak.wikipediaUrl !== null ? (
            <Pressable
              accessibilityRole="link"
              onPress={() => void Linking.openURL(peak.wikipediaUrl as string)}
              style={styles.link}
            >
              <Text style={styles.linkText}>Lire l'article Wikipedia</Text>
            </Pressable>
          ) : null}

          <Text style={styles.attribution}>
            Sommet : OpenStreetMap, ODbL
            {peak.description !== null ? '  ·  Description : Wikipedia, CC BY-SA' : ''}
          </Text>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  sheet: {
    marginTop: 'auto',
    maxHeight: '72%',
    backgroundColor: theme.color.sheet,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.color.sheetBorder,
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 3,
    marginTop: theme.space(3),
    backgroundColor: theme.color.textFaint,
  },
  content: {
    padding: theme.space(6),
    paddingBottom: theme.space(12),
  },
  name: {
    color: theme.color.text,
    fontFamily: theme.font.sans,
    fontSize: theme.size.title,
    fontWeight: '600',
    letterSpacing: -0.6,
  },
  fields: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: theme.space(5),
    marginBottom: theme.space(5),
  },
  field: {
    marginRight: theme.space(8),
    marginBottom: theme.space(3),
  },
  fieldLabel: {
    color: theme.color.textFaint,
    fontFamily: theme.font.sans,
    fontSize: theme.size.caption,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  fieldValue: {
    color: theme.color.text,
    fontFamily: theme.font.numeric,
    fontSize: theme.size.body,
    fontVariant: ['tabular-nums'],
    marginTop: 2,
  },
  description: {
    color: theme.color.textMuted,
    fontFamily: theme.font.sans,
    fontSize: theme.size.body,
    lineHeight: 23,
  },
  missing: {
    color: theme.color.textFaint,
    fontFamily: theme.font.sans,
    fontSize: theme.size.body,
    fontStyle: 'italic',
    lineHeight: 23,
  },
  link: {
    marginTop: theme.space(5),
    paddingVertical: theme.space(3),
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: theme.color.sheetBorder,
  },
  linkText: {
    color: theme.color.accent,
    fontFamily: theme.font.sans,
    fontSize: theme.size.body,
  },
  attribution: {
    color: theme.color.textFaint,
    fontFamily: theme.font.sans,
    fontSize: theme.size.caption,
    marginTop: theme.space(6),
  },
});
