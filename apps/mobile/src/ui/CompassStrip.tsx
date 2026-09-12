import { useMemo, useRef } from 'react';
import { PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import { bearingDelta, normalizeBearing } from '@ppf/peak-geometry';
import { theme } from './theme';

/** Etendue angulaire visible sur le ruban, en degres. */
const VISIBLE_SPAN_DEG = 100;

/** Pas des graduations, en degres. */
const TICK_STEP_DEG = 10;

const CARDINALS: Readonly<Record<number, string>> = {
  0: 'N', 45: 'NE', 90: 'E', 135: 'SE', 180: 'S', 225: 'SO', 270: 'O', 315: 'NO',
};

interface CompassStripProps {
  readonly heading: number;
  readonly headingOffset: number;
  readonly width: number;
  /** FOV horizontal de la camera, pour que le glissement deplace les etiquettes
   *  d'autant de pixels que le doigt. */
  readonly horizontalFov: number;
  readonly onAdjust: (deltaDegrees: number) => void;
  readonly onReset: () => void;
}

/**
 * Ruban de cap, et reglage de la correction de cap.
 *
 * Les deux tiennent dans le meme element a dessein : c'est en comparant le
 * paysage aux etiquettes que l'utilisateur constate le decalage, et c'est au
 * meme instant qu'il doit pouvoir le corriger. Un ecran de reglages separe
 * l'obligerait a memoriser l'erreur puis a la retrouver.
 *
 * Le magnetometre d'un telephone derive de plusieurs degres, davantage pres
 * d'une voiture ou d'un sac a armature. A 15 km, deux degres deplacent une
 * etiquette d'un demi-kilometre de terrain.
 */
export function CompassStrip({
  heading,
  headingOffset,
  width,
  horizontalFov,
  onAdjust,
  onReset,
}: CompassStripProps) {
  const pixelsPerDegree = width / VISIBLE_SPAN_DEG;
  const lastX = useRef(0);

  const responder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_event, gesture) => Math.abs(gesture.dx) > 3,
        onPanResponderGrant: () => {
          lastX.current = 0;
        },
        onPanResponderMove: (_event, gesture) => {
          const step = gesture.dx - lastX.current;
          lastX.current = gesture.dx;
          // Glisser vers la droite doit pousser les etiquettes vers la droite,
          // ce qui revient a diminuer le cap. L'echelle est celle de la camera,
          // pas celle du ruban : le doigt et les etiquettes avancent ensemble.
          onAdjust((-step * horizontalFov) / width);
        },
      }),
    [horizontalFov, width, onAdjust],
  );

  const ticks = useMemo(() => {
    const centre = Math.round(heading / TICK_STEP_DEG) * TICK_STEP_DEG;
    const half = Math.ceil(VISIBLE_SPAN_DEG / 2 / TICK_STEP_DEG) * TICK_STEP_DEG;
    const result: { bearing: number; offset: number; cardinal: string | undefined }[] = [];
    for (let bearing = centre - half; bearing <= centre + half; bearing += TICK_STEP_DEG) {
      const normalized = normalizeBearing(bearing);
      result.push({
        bearing: normalized,
        offset: width / 2 + bearingDelta(heading, normalized) * pixelsPerDegree,
        cardinal: CARDINALS[normalized],
      });
    }
    return result;
  }, [heading, pixelsPerDegree, width]);

  const hasOffset = Math.abs(headingOffset) >= 0.5;

  return (
    <View style={styles.container} {...responder.panHandlers}>
      <View style={styles.ribbon}>
        {ticks.map((tick) => (
          <View key={tick.bearing} style={[styles.tickGroup, { left: tick.offset }]}>
            <View style={[styles.tick, tick.cardinal !== undefined && styles.tickMajor]} />
            {tick.cardinal !== undefined ? (
              <Text style={styles.cardinal}>{tick.cardinal}</Text>
            ) : null}
          </View>
        ))}
        <View style={styles.needle} />
      </View>

      <View style={styles.readout}>
        <Text style={styles.heading}>{`${Math.round(heading).toString().padStart(3, '0')}°`}</Text>
        {hasOffset ? (
          <Pressable accessibilityRole="button" onPress={onReset} hitSlop={12}>
            <Text style={styles.offset}>
              {`correction ${headingOffset > 0 ? '+' : '−'}${Math.abs(headingOffset).toFixed(1)}°  ·  annuler`}
            </Text>
          </Pressable>
        ) : (
          <Text style={styles.hint}>glisser pour recaler la boussole</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: theme.space(3),
    paddingBottom: theme.space(2),
    backgroundColor: 'rgba(12, 14, 18, 0.55)',
  },
  ribbon: {
    height: 26,
    justifyContent: 'flex-start',
  },
  tickGroup: {
    position: 'absolute',
    alignItems: 'center',
    width: 40,
    marginLeft: -20,
  },
  tick: {
    width: StyleSheet.hairlineWidth,
    height: 6,
    backgroundColor: theme.color.labelMuted,
  },
  tickMajor: {
    height: 10,
    backgroundColor: theme.color.label,
  },
  cardinal: {
    color: theme.color.label,
    fontFamily: theme.font.sans,
    fontSize: theme.size.caption,
    fontWeight: '600',
    letterSpacing: 1,
    marginTop: 2,
  },
  // Le repere central est en accent : c'est l'axe optique, la seule graduation
  // qui compte pour lire le panorama.
  needle: {
    position: 'absolute',
    left: '50%',
    width: 1,
    height: 14,
    marginLeft: -0.5,
    backgroundColor: theme.color.accent,
  },
  readout: {
    alignItems: 'center',
    marginTop: theme.space(1),
  },
  heading: {
    color: theme.color.label,
    fontFamily: theme.font.numeric,
    fontSize: theme.size.body,
    fontVariant: ['tabular-nums'],
    letterSpacing: 1,
  },
  hint: {
    color: theme.color.textFaint,
    fontFamily: theme.font.sans,
    fontSize: theme.size.caption,
    marginTop: 1,
  },
  offset: {
    color: theme.color.accent,
    fontFamily: theme.font.sans,
    fontSize: theme.size.caption,
    marginTop: 1,
  },
});
