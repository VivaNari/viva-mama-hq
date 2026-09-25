import { EMood, MoodOption } from '../types/moodLog.types';

/**
 * The 5-point mood scale. `size`, `offsetY` and `rotate` drive the scattered
 * "messy" bubble cluster layout in MoodFaceSelector (organic, non-row arrangement).
 * NOTE: `label` and `caption` hold i18n keys (resolved with t() at render).
 */
export const MOOD_OPTIONS: MoodOption[] = [
  {
    value: EMood.EXTREMELY_SAD,
    label: 'moodLog.labels.verySad',
    emoji: '😭',
    color: '#F44336',
    caption: 'moodLog.captions.verySad',
    size: 64,
    offsetY: 18,
    rotate: -8,
  },
  {
    value: EMood.SAD,
    label: 'moodLog.labels.sad',
    emoji: '😟',
    color: '#FF7043',
    caption: 'moodLog.captions.sad',
    size: 76,
    offsetY: -10,
    rotate: 6,
  },
  {
    value: EMood.NEUTRAL,
    label: 'moodLog.labels.okay',
    emoji: '😐',
    color: '#FFB300',
    caption: 'moodLog.captions.okay',
    size: 58,
    offsetY: 32,
    rotate: -4,
  },
  {
    value: EMood.HAPPY,
    label: 'moodLog.labels.happy',
    emoji: '🙂',
    color: '#9CCC65',
    caption: 'moodLog.captions.happy',
    size: 80,
    offsetY: 0,
    rotate: 7,
  },
  {
    value: EMood.EXTREMELY_HAPPY,
    label: 'moodLog.labels.veryHappy',
    emoji: '😄',
    color: '#4CAF50',
    caption: 'moodLog.captions.veryHappy',
    size: 66,
    offsetY: 24,
    rotate: -6,
  },
];

export const getMoodOption = (mood?: EMood | null): MoodOption | undefined =>
  MOOD_OPTIONS.find((m) => m.value === mood);
