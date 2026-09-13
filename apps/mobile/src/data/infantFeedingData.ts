import { IFeedingTypeOption, TFeedSide } from '../types/infantLog.types';

/**
 * The three feeding types from the PRD (4.3.1–4.3.3).
 *
 * The choice is not cosmetic: it decides which fields the schedule below offers, which is
 * exactly what the PRD asks for — "based on the chosen option we will enable the mother to
 * insert the logs".
 */
export const FEEDING_TYPES: IFeedingTypeOption[] = [
  {
    key: 'exclusive_breastfeeding',
    labelKey: 'infant.feeding.typeBreastfeeding',
    descriptionKey: 'infant.feeding.typeBreastfeedingHint',
  },
  {
    key: 'formula',
    labelKey: 'infant.feeding.typeFormula',
    descriptionKey: 'infant.feeding.typeFormulaHint',
  },
  {
    key: 'mixed',
    labelKey: 'infant.feeding.typeMixed',
    descriptionKey: 'infant.feeding.typeMixedHint',
  },
];

/**
 * Which sides a feed row can be attributed to, per feeding type.
 *
 * A mother who is exclusively breastfeeding should not be offered "Bottle", and a
 * formula-fed baby has no side at all — the row collapses to time and millilitres.
 */
export const SIDES_FOR_TYPE: Record<string, TFeedSide[]> = {
  exclusive_breastfeeding: ['left', 'right'],
  formula: ['bottle'],
  mixed: ['left', 'right', 'bottle'],
};

export const SIDE_LABEL_KEYS: Record<TFeedSide, string> = {
  left: 'infant.feeding.sideLeft',
  right: 'infant.feeding.sideRight',
  bottle: 'infant.feeding.sideBottle',
};

/**
 * Reactions to a new food, from the 6-months+ design.
 *
 * Multi-select: "liked it" and "loose stool" are not mutually exclusive, and a parent
 * forced to pick one would drop the half a paediatrician cares about.
 */
export const FOOD_REACTIONS = [
  { key: 'liked', labelKey: 'infant.feeding.reactionLiked' },
  { key: 'refused', labelKey: 'infant.feeding.reactionRefused' },
  { key: 'rash', labelKey: 'infant.feeding.reactionRash' },
  { key: 'loose_stool', labelKey: 'infant.feeding.reactionLooseStool' },
];

/** Quick-add amounts for the water tally. Small sips are the point at this age. */
export const WATER_INCREMENTS_ML = [15, 30, 50];
