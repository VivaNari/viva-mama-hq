import { colors } from '../public/assets/colors';
import { IDiaperKindConfig } from '../types/infantLog.types';

/**
 * The three diaper kinds, each with its own colour so the quick-log tiles can be hit
 * without being read — this is a screen used one-handed at 3am.
 */
export const DIAPER_KINDS: IDiaperKindConfig[] = [
  {
    kind: 'wet',
    labelKey: 'infant.diaper.wet',
    descriptionKey: 'infant.diaper.wetHint',
    icon: 'water-outline',
    background: colors.diaperWetBG,
    foreground: colors.diaperWetText,
  },
  {
    kind: 'dirty',
    labelKey: 'infant.diaper.dirty',
    descriptionKey: 'infant.diaper.dirtyHint',
    icon: 'circle-slice-8',
    background: colors.diaperDirtyBG,
    foreground: colors.diaperDirtyText,
  },
  {
    kind: 'both',
    labelKey: 'infant.diaper.both',
    descriptionKey: 'infant.diaper.bothHint',
    icon: 'layers-outline',
    background: colors.diaperBothBG,
    foreground: colors.diaperBothText,
  },
];
