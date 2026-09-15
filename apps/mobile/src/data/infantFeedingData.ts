import {
  IFeedingMethodOption,
  IFoodReactionOption,
  TFeedChoice,
} from '../types/infantLog.types';
import { FeedingMethodEnum } from '../types/user.types';

/**
 * The three feeding methods from the PRD (4.3.1–4.3.3).
 *
 * The choice is not cosmetic: it decides which fields the schedule below offers, which is
 * exactly what the PRD asks for — "based on the chosen option we will enable the mother to
 * insert the logs".
 *
 * Keyed on `FeedingMethodEnum`, the vocabulary the mother's own onboarding question already
 * stores. The labels are the design's ("Formula fed" where the onboarding flow says "Not
 * breastfeeding"), because a mother reading a feeding log is thinking about the bottle
 * rather than about what she has stopped doing. The value underneath is the same one, so
 * her onboarding answer can seed this screen's default without a translation step.
 */
export const FEEDING_METHODS: IFeedingMethodOption[] = [
  {
    key: FeedingMethodEnum.ONLY_BREASTMILK,
    labelKey: 'infant.feeding.typeBreastfeeding',
    descriptionKey: 'infant.feeding.typeBreastfeedingHint',
  },
  {
    key: FeedingMethodEnum.NOT_BREASTFEEDING,
    labelKey: 'infant.feeding.typeFormula',
    descriptionKey: 'infant.feeding.typeFormulaHint',
  },
  {
    key: FeedingMethodEnum.MIXED,
    labelKey: 'infant.feeding.typeMixed',
    descriptionKey: 'infant.feeding.typeMixedHint',
  },
];

/**
 * Which choices a feed row offers, per feeding method.
 *
 * A mother who is exclusively breastfeeding should not be offered "Bottle", and a
 * formula-fed baby has no side at all — the row collapses to a time and millilitres.
 *
 * This shapes the form only. The server accepts a bottle feed under any method, because
 * expressed breastmilk in a bottle is ordinary and refusing to store it would be the app
 * telling a mother she had not done something she had just done.
 */
export const CHOICES_FOR_METHOD: Record<FeedingMethodEnum, TFeedChoice[]> = {
  [FeedingMethodEnum.ONLY_BREASTMILK]: ['left', 'right'],
  [FeedingMethodEnum.NOT_BREASTFEEDING]: ['bottle'],
  [FeedingMethodEnum.MIXED]: ['left', 'right', 'bottle'],
};

export const CHOICE_LABEL_KEYS: Record<TFeedChoice, string> = {
  left: 'infant.feeding.sideLeft',
  right: 'infant.feeding.sideRight',
  bottle: 'infant.feeding.sideBottle',
};

/**
 * Reactions to a new food, from the 6-months+ design.
 *
 * Multi-select: "liked it" and "loose stool" are not mutually exclusive, and a parent forced
 * to pick one would drop the half a paediatrician cares about. Recorded against the food
 * rather than against the day, because which food caused the rash is the question.
 */
export const FOOD_REACTIONS: IFoodReactionOption[] = [
  { key: 'liked', labelKey: 'infant.feeding.reactionLiked' },
  { key: 'refused', labelKey: 'infant.feeding.reactionRefused' },
  { key: 'rash', labelKey: 'infant.feeding.reactionRash' },
  { key: 'loose_stool', labelKey: 'infant.feeding.reactionLooseStool' },
];

/** Quick-add amounts for the water tally. Small sips are the point at this age. */
export const WATER_INCREMENTS_ML = [15, 30, 50];
