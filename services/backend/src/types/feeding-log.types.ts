import { Schema } from "mongoose";

import { FeedingMethodEnum } from "./user.types";

/**
 * A day of feeding for one child.
 *
 * One document per child per IST calendar day with three arrays inside it, the shape every
 * other day-keyed log in this codebase uses (`diaper_logs`, `growth_logs`, `mood_logs`).
 * The reasoning in `diaper-log.types.ts` carries over unchanged: the figures the screen
 * renders are a single-document read, and the arrays are bounded by physiology — a newborn
 * feeds 8-12 times a day, eats nothing, and drinks no water.
 *
 * Three arrays rather than one `entries` array with a discriminator, because the three
 * carry genuinely different fields and a union would leave every reader narrowing before
 * it could count anything.
 */

/** What the baby was given. Orthogonal to how it reached them — see `TDeliveryMethod`. */
export type TMilkSource = "breastmilk" | "formula";
export const MILK_SOURCES: TMilkSource[] = ["breastmilk", "formula"];

/**
 * How the milk reached the baby.
 *
 * `direct` is the breast itself; the rest are vessels, and they are the ones a mother in
 * India actually uses — a paladai and a katori are not "other".
 */
export type TDeliveryMethod = "direct" | "paladai" | "katori" | "cup" | "spoon" | "bottle";
export const DELIVERY_METHODS: TDeliveryMethod[] = [
    "direct",
    "paladai",
    "katori",
    "cup",
    "spoon",
    "bottle",
];

export type TFeedSide = "left" | "right" | "both";
export const FEED_SIDES: TFeedSide[] = ["left", "right", "both"];

/** The reactions the design offers under a new food. Multi-select — see the client's list. */
export type TFoodReaction = "liked" | "refused" | "rash" | "loose_stool" | "allergy";
export const FOOD_REACTIONS: TFoodReaction[] = [
    "liked",
    "refused",
    "rash",
    "loose_stool",
    "allergy",
];

/** How a portion of solid food is measured. Household units, not grams. */
export type TSolidQuantityUnit = "spoon" | "katori" | "piece";
export const SOLID_QUANTITY_UNITS: TSolidQuantityUnit[] = ["spoon", "katori", "piece"];

/**
 * How the food was prepared.
 *
 * Texture is the part of complementary feeding that changes month by month — a
 * six-month-old takes a smooth mash and a ten-month-old takes finger food — so it is
 * recorded rather than left to the food's name.
 */
export type TSolidTexture = "smooth_mash" | "mashed_with_lumps" | "finely_chopped" | "finger_food";
export const SOLID_TEXTURES: TSolidTexture[] = [
    "smooth_mash",
    "mashed_with_lumps",
    "finely_chopped",
    "finger_food",
];

/** Which of the three arrays a write addresses. The client sends it; the routes are shared. */
export type TFeedingEntryKind = "feed" | "solid" | "water";
export const FEEDING_ENTRY_KINDS: TFeedingEntryKind[] = ["feed", "solid", "water"];

/**
 * One milk feed.
 *
 * What was given and how it was given are two fields rather than one. Expressed breastmilk
 * from a katori and formula from a katori are the same act with different milk, and a
 * single column that is sometimes a milk and sometimes a vessel cannot be counted either way.
 *
 * `minutes` and `ml` are likewise separate, never one `amount`. Minutes on the breast and
 * millilitres in a vessel are different quantities, and a single number meaning either
 * depending on a sibling field is not something anyone should hand a paediatrician.
 *
 * Any combination is valid whatever the day's `feedingMethod` says. The method decides
 * which controls the screen offers rather than what the record is allowed to contain.
 */
export interface IFeedEntry {
    _id: Schema.Types.ObjectId;
    milkSource: TMilkSource;
    /**
     * How the milk reached the baby.
     *
     * Absent on a mixed feed, and meaningfully so: the design asks a mother feeding both
     * only what was given and how much, so a vessel recorded there would be invented.
     */
    deliveryMethod?: TDeliveryMethod;
    /** Which breast. Present for `direct` only — a vessel has no side. */
    side?: TFeedSide;
    /** Time at the breast. Present for `direct` only. */
    minutes?: number;
    /** Volume taken. Present for everything except `direct`. */
    ml?: number;
    /**
     * When the feed happened, not when the request arrived — the same contract the diaper
     * log's `loggedAt` carries, so a feed entered an hour later keeps its real time.
     */
    feedAt: Date;
}

/** One solid food, with the reactions to it. */
export interface ISolidEntry {
    _id: Schema.Types.ObjectId;
    /** Free text: the foods a mother in India logs are not an enumerable list. */
    food: string;
    /**
     * Held on the food rather than on the day.
     *
     * Which food caused the rash is the question a reaction is asked to answer, and a
     * day-level chip row — what the original design drew — cannot answer it.
     */
    reactions: TFoodReaction[];
    /**
     * How much was eaten, in `quantityUnit`.
     *
     * Optional, with the unit: a mother logging a first taste one-handed should not be
     * stopped by a field she has not measured, and the food's name is the part that matters.
     */
    quantity?: number;
    quantityUnit?: TSolidQuantityUnit;
    /** How the food was prepared. Optional for the same reason. */
    texture?: TSolidTexture;
    feedAt: Date;
}

/** One drink of water. Only the day's total is rendered; the entry is what makes undo work. */
export interface IWaterEntry {
    _id: Schema.Types.ObjectId;
    ml: number;
    drankAt: Date;
}

export interface IFeedingLog {
    _id: Schema.Types.ObjectId;
    userId: Schema.Types.ObjectId;
    /**
     * Matches `users.childs[]._id`. Not a Mongoose `ref` — children are embedded
     * subdocuments, so there is no collection to populate from.
     */
    childId: Schema.Types.ObjectId;

    /** IST start-of-day, derived on the server from the entry's own instant. */
    loggedOn: Date;

    /**
     * The feeding method in force on this day, stamped when the day is first written.
     *
     * A copy rather than a join onto the child, and deliberately so: the child carries what
     * is true *now*, and a mother who moves to formula in October must not have July read
     * back as formula. Changing the method rewrites today's row and no earlier one.
     */
    feedingMethod: FeedingMethodEnum;

    feeds: IFeedEntry[];
    solids: ISolidEntry[];
    water: IWaterEntry[];

    createdAt: Date;
    updatedAt: Date;
}

/** Derived on read, never stored — the figures the "Today" card shows. */
export interface IFeedingTotals {
    feeds: number;
    /** Largest span between consecutive feeds, in minutes. Null until there are two. */
    longestGapMinutes: number | null;
    solids: number;
    waterMl: number;
}

/**
 * The per-child feeding settings the screen opens with.
 *
 * Returned alongside the days rather than read from the child in route params, because
 * route params are a snapshot of a SQLite cache that another device — or Edit Profile —
 * can have moved on from. One request, and the fallback chain lives on the server.
 */
export interface IFeedingSettings {
    feedingMethod: FeedingMethodEnum;
    /** Where that value came from, so the client never has to re-derive the chain. */
    feedingMethodSource: "child" | "onboarding" | "default";
    /** ISO "YYYY-MM-DD", or null when complementary feeding has not started. */
    solidsStartedOn: string | null;
    /** Whether the child is old enough for solids and water to be offered at all. */
    solidsAvailable: boolean;
}
