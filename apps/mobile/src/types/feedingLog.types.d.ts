import { FeedingMethodEnum } from "./user.types";

/**
 * What the feeding-log API stores and returns.
 *
 * Separate from `infantLog.types`, which describes *content* — the options a screen offers.
 * These are server rows, and they follow the same split the growth, diaper, milestone and
 * vaccination logs already use.
 *
 * Dates arrive as ISO strings rather than `Date`: these cross a JSON boundary, and typing
 * them as `Date` would be a lie the compiler could not catch.
 */

/** What the baby was given. Orthogonal to how it reached them — see `TDeliveryMethod`. */
export type TMilkSource = "breastmilk" | "formula";
/** How it reached them: the breast itself, or one of the vessels the design offers. */
export type TDeliveryMethod =
  | "direct"
  | "paladai"
  | "katori"
  | "cup"
  | "spoon"
  | "bottle";
export type TFeedSide = "left" | "right" | "both";
export type TFoodReaction =
  | "liked"
  | "refused"
  | "rash"
  | "loose_stool"
  | "allergy";
export type TSolidQuantityUnit = "spoon" | "katori" | "piece";
export type TSolidTexture =
  | "smooth_mash"
  | "mashed_with_lumps"
  | "finely_chopped"
  | "finger_food";

/** Which of the day's three arrays a write addresses. */
export type TFeedingEntryKind = "feed" | "solid" | "water";

/**
 * One milk feed.
 *
 * What was given and how it was given are two fields, not one: expressed breastmilk from a
 * katori and formula from a katori are the same act with different milk.
 *
 * `minutes` and `ml` are separate for the same reason. Minutes at the breast and millilitres
 * in a vessel are different quantities, and the single `amount` string this screen used to
 * keep meant either one depending on a sibling field.
 */
export interface IFeedEntry {
  _id: string;
  milkSource: TMilkSource;
  /** Absent on a mixed feed, where the design asks only what was given and how much. */
  deliveryMethod?: TDeliveryMethod;
  /** Which breast. Present for `direct` only. */
  side?: TFeedSide;
  /** Time at the breast. Present for `direct` only. */
  minutes?: number;
  /** Volume taken. Present for everything except `direct`. */
  ml?: number;
  /** ISO instant — when the feed happened, not when it was typed in. */
  feedAt: string;
}

export interface ISolidEntry {
  _id: string;
  food: string;
  /** Held on the food, because which food caused the rash is the question being asked. */
  reactions: TFoodReaction[];
  /** How much was eaten, in `quantityUnit`. Optional — the food's name is what matters. */
  quantity?: number;
  quantityUnit?: TSolidQuantityUnit;
  /** How the food was prepared. Optional for the same reason. */
  texture?: TSolidTexture;
  feedAt: string;
}

export interface IWaterEntry {
  _id: string;
  ml: number;
  drankAt: string;
}

/** Derived by the server on every read. Never stored, never computed twice. */
export interface IFeedingTotals {
  feeds: number;
  /** Largest span between consecutive feeds, in minutes. Null until there are two. */
  longestGapMinutes: number | null;
  solids: number;
  waterMl: number;
}

export interface IFeedingDay {
  _id: string;
  childId: string;
  /** "YYYY-MM-DD" for the IST calendar day — what the date strip keys its chips on. */
  loggedOn: string;
  /** The method in force on this day, not the child's current one. */
  feedingMethod: FeedingMethodEnum;
  feeds: IFeedEntry[];
  solids: ISolidEntry[];
  water: IWaterEntry[];
  totals: IFeedingTotals;
  createdAt: string;
  updatedAt: string;
}

/**
 * The per-child settings the screen opens with, resolved server-side.
 *
 * They travel with the day list rather than being read off route params, which are a
 * snapshot of the app's cached copy of the user and can be behind what another device has
 * written. `feedingMethodSource` is carried so the screen can say where the default came
 * from without re-deriving the chain.
 */
export interface IFeedingSettings {
  feedingMethod: FeedingMethodEnum;
  feedingMethodSource: "child" | "onboarding" | "default";
  /** "YYYY-MM-DD", or null when complementary feeding has not started. */
  solidsStartedOn: string | null;
  /** Whether the child is old enough for solids and water to be offered at all. */
  solidsAvailable: boolean;
}

export interface IFeedingLogResponse {
  settings: IFeedingSettings;
  days: IFeedingDay[];
}

/** What the POST returns: the stored entry, plus the day it landed on. */
export interface IFeedingEntryCreated {
  childId: string;
  loggedOn: string;
  kind: TFeedingEntryKind;
  entry: IFeedEntry | ISolidEntry | IWaterEntry;
  totals: IFeedingTotals;
}
