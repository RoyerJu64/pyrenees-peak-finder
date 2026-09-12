import { Pressable, StyleSheet, Text, View } from 'react-native';
import { theme } from './theme';

interface StatusScreenProps {
  readonly title: string;
  readonly message: string;
  readonly action?: { readonly label: string; readonly onPress: () => void };
}

/**
 * Ecran plein pour les etats ou l'application ne peut rien afficher :
 * permission refusee, capteur absent, position introuvable. Chaque message dit
 * ce qui manque et ce que l'utilisateur peut y faire.
 */
export function StatusScreen({ title, message, action }: StatusScreenProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
      {action !== undefined ? (
        <Pressable accessibilityRole="button" onPress={action.onPress} style={styles.action}>
          <Text style={styles.actionText}>{action.label}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: theme.space(8),
    backgroundColor: theme.color.screen,
  },
  title: {
    color: theme.color.text,
    fontFamily: theme.font.sans,
    fontSize: theme.size.title,
    fontWeight: '600',
    letterSpacing: -0.6,
  },
  message: {
    color: theme.color.textMuted,
    fontFamily: theme.font.sans,
    fontSize: theme.size.body,
    lineHeight: 23,
    marginTop: theme.space(4),
  },
  action: {
    alignSelf: 'flex-start',
    marginTop: theme.space(8),
    paddingVertical: theme.space(3),
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: theme.color.sheetBorder,
  },
  actionText: {
    color: theme.color.accent,
    fontFamily: theme.font.sans,
    fontSize: theme.size.body,
  },
});
