import { Platform } from 'react-native';

/**
 * Jetons de style. L'overlay se superpose a une image de montagne : le
 * contraste doit venir du texte lui-meme et de filets fins, pas de pastilles
 * ni d'ombres portees qui masqueraient le paysage.
 */
export const theme = {
  color: {
    /** Texte principal de l'overlay, sur fond camera. */
    label: '#FFFFFF',
    /** Altitude, distance : presents sans concurrencer le nom. */
    labelMuted: 'rgba(255, 255, 255, 0.68)',
    /** Voile derriere le texte, juste assez pour tenir sur un ciel clair. */
    labelBacking: 'rgba(12, 14, 18, 0.55)',
    /** Filet de rappel entre l'etiquette et le sommet. */
    leader: 'rgba(255, 255, 255, 0.45)',
    /** Repere pose sur le sommet lui-meme. */
    marker: '#FFFFFF',
    /** Sommet documente : le nom est cliquable. */
    accent: '#F2C14E',

    screen: '#0C0E12',
    sheet: '#15181E',
    sheetBorder: 'rgba(255, 255, 255, 0.10)',
    text: '#F4F5F7',
    textMuted: 'rgba(244, 245, 247, 0.62)',
    textFaint: 'rgba(244, 245, 247, 0.38)',
  },

  font: {
    // Pas de police embarquee : les fontes systeme sont dessinees pour l'ecran
    // du telephone et evitent 2 Mo de fichiers pour un gain discutable.
    sans: Platform.select({ ios: 'System', android: 'sans-serif', default: 'System' }),
    // Chiffres de largeur fixe : les altitudes s'alignent en colonne au lieu
    // de danser quand la valeur change.
    numeric: Platform.select({
      ios: 'System',
      android: 'sans-serif-medium',
      default: 'System',
    }),
  },

  size: {
    label: 15,
    labelDetail: 11,
    title: 26,
    body: 15,
    caption: 12,
  },

  space: (steps: number): number => steps * 4,
} as const;

/** Hauteur d'une etiquette, en pixels. Necessaire a la mise en page avant rendu. */
export const LABEL_HEIGHT = 34;

/**
 * Largeur estimee d'une etiquette, faute de pouvoir mesurer le texte avant de
 * le poser. Facteur cale sur la fonte systeme a 15 pt ; une sous-estimation
 * ferait se toucher deux etiquettes, une surestimation en ecarterait a tort.
 */
export const estimateLabelWidth = (name: string): number =>
  Math.min(240, Math.max(72, name.length * 8.2 + theme.space(6)));
