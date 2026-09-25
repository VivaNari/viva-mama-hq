import { Schema } from "mongoose";
import { EUserCategory } from "./user.types";
import { FlowLanguage } from "./chat.types";

/**
 * Translatable display fields of a content article for one non-default
 * language. `contentBody`, when present, is a full parallel array that
 * replaces the base body (same order; VIDEO/IMAGE bodies usually carry the
 * same URL). Any field may be omitted; the base (English) value is used.
 */
export interface IContentTranslationBundle {
    featuredTitle?: string;
    contentBody?: IContentBody[];
}

export type IContentTranslations = Partial<Record<FlowLanguage, IContentTranslationBundle>>;

/**
 * Splits the catalog for tier gating. GLOBAL_HEALTH is open to every tier including
 * FREE; WEEKLY_RECOVERY is the week-matched series that free users see only one of
 * (the item matching their current week).
 */
export enum EContentGroup {
    GLOBAL_HEALTH = "GLOBAL_HEALTH",
    WEEKLY_RECOVERY = "WEEKLY_RECOVERY",
}

export interface IContent {
    _id: Schema.Types.ObjectId;
    featuredImage: string;
    featuredTitle: string;
    /**
     * Which user categories this article applies to. An array because an article
     * relevant to both postpartum and pregnant women would otherwise have to be
     * duplicated into two documents that then drift apart.
     *
     * Query sites need no change: `{ category: "PP" }` matches any document whose
     * array contains "PP" under Mongo's implicit $in semantics.
     */
    category: EUserCategory[];
    /**
     * null means "not yet classified" — content-ops must set this to GLOBAL_HEALTH or
     * WEEKLY_RECOVERY by hand. The VIDEO-body heuristic in the P0 migration only sets
     * GLOBAL_HEALTH; everything it is unsure about is left null rather than guessed.
     * Access-wise, null is treated as non-global-health (i.e. sliced like weekly
     * recovery), so unclassified content is never accidentally made always-free.
     */
    contentGroup: EContentGroup | null;
    /** Deterministic ordering for the free/trial slice. */
    sortOrder: number;
    /** Lets content-ops promote one premium article as a free teaser, without a code change. */
    isFreeOverride: boolean;
    validWeekStart: number;
    validWeekEnd: number;
    authors: Schema.Types.ObjectId[];
    reviewers: Schema.Types.ObjectId[];
    contentBody: IContentBody[];
    translations?: IContentTranslations;
    /** Set on gated list/detail responses. Never persisted. */
    isLocked?: boolean;
}

export enum ContentBodyTypeEnum {
    IMAGE = "IMAGE",
    HEADING = "HEADING",
    SUBHEADING = "SUBHEADING",
    PARAGRAPH = "PARAGRAPH",
    VIDEO = "VIDEO",
}

export interface IContentBody {
    contentType: ContentBodyTypeEnum;
    body: string;
}
