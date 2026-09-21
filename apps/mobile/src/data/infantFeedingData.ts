import {
  IBreastfeedingModeOption,
  IDeliveryMethodOption,
  IFeedSideOption,
  IFeedingMethodOption,
  IFoodReactionOption,
  IMilkSourceOption,
  ISolidQuantityUnitOption,
  ISolidTextureOption,
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
 * How the breast milk was given, asked under "Exclusively breastfeeding" only.
 *
 * Expressed milk is still exclusive breastfeeding, and a mother who pumps had no way to say
 * so: the old form offered her Left and Right and a duration, so a 60 ml katori feed went
 * in as minutes at a breast the baby never touched.
 */
export const BREASTFEEDING_MODES: IBreastfeedingModeOption[] = [
  { key: 'direct', labelKey: 'infant.feeding.modeDirect' },
  { key: 'expressed', labelKey: 'infant.feeding.modeExpressed' },
];

/**
 * The vessels, for expressed breastmilk and for formula alike.
 *
 * A paladai and a katori are how a great many Indian babies are actually fed, and an
 * options list that stopped at "bottle" was asking a mother to misreport the feed. The
 * spoon carries its local name in the label — "Spoon (chammach)" — because that is the word
 * the design uses and the one she is reading the screen in.
 */
export const FEEDING_VESSELS: IDeliveryMethodOption[] = [
  { key: 'paladai', labelKey: 'infant.feeding.vesselPaladai' },
  { key: 'katori', labelKey: 'infant.feeding.vesselKatori' },
  { key: 'cup', labelKey: 'infant.feeding.vesselCup' },
  { key: 'spoon', labelKey: 'infant.feeding.vesselSpoon' },
  { key: 'bottle', labelKey: 'infant.feeding.vesselBottle' },
];

/** Which breast, for a direct feed. "Both" is one feed, not two half-feeds. */
export const FEED_SIDES: IFeedSideOption[] = [
  { key: 'left', labelKey: 'infant.feeding.sideLeft' },
  { key: 'right', labelKey: 'infant.feeding.sideRight' },
  { key: 'both', labelKey: 'infant.feeding.sideBoth' },
];

/**
 * What was given, on a mixed feed.
 *
 * This replaces the Left/Right/Bottle the mixed row used to offer, which conflated a breast
 * with a vessel and left no way to say the bottle held formula rather than expressed milk —
 * the one thing a mixed-feeding log exists to record.
 */
export const MIXED_MILK_SOURCES: IMilkSourceOption[] = [
  { key: 'breastmilk', labelKey: 'infant.feeding.milkBreastmilk' },
  { key: 'formula', labelKey: 'infant.feeding.milkFormula' },
];

/** Portions, in the units a kitchen has rather than in grams. */
export const SOLID_QUANTITY_UNITS: ISolidQuantityUnitOption[] = [
  { key: 'spoon', labelKey: 'infant.feeding.unitSpoon' },
  { key: 'katori', labelKey: 'infant.feeding.unitKatori' },
  { key: 'piece', labelKey: 'infant.feeding.unitPiece' },
];

/**
 * How the food was made.
 *
 * Texture is the part of complementary feeding that moves month by month, and it is what a
 * paediatrician asks about when a baby gags or refuses — the food's name alone does not say
 * whether it arrived as a smooth mash or as finger food.
 */
export const SOLID_TEXTURES: ISolidTextureOption[] = [
  { key: 'smooth_mash', labelKey: 'infant.feeding.textureSmoothMash' },
  { key: 'mashed_with_lumps', labelKey: 'infant.feeding.textureMashedLumps' },
  { key: 'finely_chopped', labelKey: 'infant.feeding.textureFinelyChopped' },
  { key: 'finger_food', labelKey: 'infant.feeding.textureFingerFood' },
];

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
  { key: 'allergy', labelKey: 'infant.feeding.reactionAllergy' },
];

/** Quick-add amounts for the water tally. Small sips are the point at this age. */
export const WATER_INCREMENTS_ML = [15, 30, 50];
