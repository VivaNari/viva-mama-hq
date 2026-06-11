import { EMood, MoodOption } from '../types/moodLog.types';

/**
 * The 5-point mood scale. `size`, `offsetY` and `rotate` drive the scattered
 * "messy" bubble cluster layout in MoodFaceSelector (organic, non-row arrangement).
 */
export const MOOD_OPTIONS: MoodOption[] = [
  {
    value: EMood.EXTREMELY_SAD,
    label: 'Very sad',
    emoji: '😭',
    color: '#F44336',
    caption: 'It’s okay to have hard days.',
    size: 64,
    offsetY: 18,
    rotate: -8,
  },
  {
    value: EMood.SAD,
    label: 'Sad',
    emoji: '😟',
    color: '#FF7043',
    caption: 'Be gentle with yourself today.',
    size: 76,
    offsetY: -10,
    rotate: 6,
  },
  {
    value: EMood.NEUTRAL,
    label: 'Okay',
    emoji: '😐',
    color: '#FFB300',
    caption: 'A steady, in-between kind of day.',
    size: 58,
    offsetY: 32,
    rotate: -4,
  },
  {
    value: EMood.HAPPY,
    label: 'Happy',
    emoji: '🙂',
    color: '#9CCC65',
    caption: 'Glad you’re feeling good.',
    size: 80,
    offsetY: 0,
    rotate: 7,
  },
  {
    value: EMood.EXTREMELY_HAPPY,
    label: 'Very happy',
    emoji: '😄',
    color: '#4CAF50',
    caption: 'Wonderful — soak it in!',
    size: 66,
    offsetY: 24,
    rotate: -6,
  },
];

export const getMoodOption = (mood?: EMood | null): MoodOption | undefined =>
  MOOD_OPTIONS.find((m) => m.value === mood);
