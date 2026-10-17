import { Document, Schema } from "mongoose";

/**
 * What is being reported.
 *
 * `AI_MESSAGE` is declared here but not yet produced by any client: Play's
 * AI-Generated Content policy requires an in-app way to flag offensive model output
 * (blocker B5), and that is the same queue with a different target. Declaring it now
 * keeps B5 from growing a second, parallel reporting system.
 */
export enum EReportTargetType {
    VIVA_CLUB_POST = "VIVA_CLUB_POST",
    VIVA_CLUB_COMMENT = "VIVA_CLUB_COMMENT",
    AI_MESSAGE = "AI_MESSAGE",
}

/**
 * SELF_HARM is deliberately separate from HARASSMENT. In a postpartum mental-health
 * community it is a welfare signal rather than a content complaint, and the admin
 * queue sorts it to the top for that reason.
 *
 * Not every reason applies to every target — see AI_MESSAGE_REPORT_REASONS. An AI does
 * not spam or harass in the sense a community member does, and offering those choices
 * would collect reports nobody can act on.
 */
export enum EReportReason {
    SPAM = "SPAM",
    HARASSMENT = "HARASSMENT",
    HATE = "HATE",
    SELF_HARM = "SELF_HARM",
    MISINFORMATION = "MISINFORMATION",
    SEXUAL = "SEXUAL",
    /**
     * Model output that could hurt someone if followed. The reason that matters most
     * for a maternal-health assistant and the one with no equivalent above:
     * MISINFORMATION covers "this is wrong", not "this is dangerous".
     */
    HARMFUL_ADVICE = "HARMFUL_ADVICE",
    OTHER = "OTHER",
}

/**
 * The reasons offered when flagging Viva AI output, in the order shown.
 *
 * Harm first, accuracy second, and OTHER last. SPAM and HARASSMENT are absent by
 * design — they describe what people do to each other, not what a model gets wrong.
 */
export const AI_MESSAGE_REPORT_REASONS: readonly EReportReason[] = [
    EReportReason.HARMFUL_ADVICE,
    EReportReason.MISINFORMATION,
    EReportReason.HATE,
    EReportReason.SEXUAL,
    EReportReason.SELF_HARM,
    EReportReason.OTHER,
] as const;

export enum EReportStatus {
    PENDING = "PENDING",
    ACTIONED = "ACTIONED",
    DISMISSED = "DISMISSED",
}

/** What a reviewer did with a report. */
export enum EReportAction {
    REMOVE = "REMOVE",
    DISMISS = "DISMISS",
    BAN_AUTHOR = "BAN_AUTHOR",
    /**
     * "Real, reviewed, and fed into filter tuning." Exists for AI reports, where there
     * is no content to remove and no author to ban, but closing the report as DISMISS
     * would record the opposite of what the reviewer decided.
     */
    ACKNOWLEDGE = "ACKNOWLEDGE",
}

/**
 * Target types where a reviewer decision changes the content itself.
 *
 * AI messages are absent deliberately. They are one half of a private conversation, so
 * there is nothing to hide from anyone else and no author to sanction — and without
 * this guard REMOVE would quietly write a `moderation` key onto a message document,
 * inventing a field the chat read path knows nothing about.
 */
export const ACTIONABLE_CONTENT_TYPES: readonly EReportTargetType[] = [
    EReportTargetType.VIVA_CLUB_POST,
    EReportTargetType.VIVA_CLUB_COMMENT,
] as const;

/**
 * Visibility of a piece of user-generated content.
 *
 * Read filters must be written as "not hidden and not removed" rather than
 * "equals VISIBLE": rows that predate this field have no `moderation` key at all, and
 * a positive match would make every existing post disappear from the feed.
 */
export enum EModerationStatus {
    VISIBLE = "VISIBLE",
    AUTO_HIDDEN = "AUTO_HIDDEN",
    REMOVED = "REMOVED",
}

/** Distinct reporters needed before content hides itself pending review. */
export const AUTO_HIDE_REPORT_THRESHOLD = 3;

export interface IModerationState {
    status: EModerationStatus;
    reportCount: number;
    hiddenAt: Date | null;
}

export interface IReport extends Document {
    targetType: EReportTargetType;
    targetId: Schema.Types.ObjectId;
    /** Author of the reported content. Null for targets that have no user author. */
    targetAuthor: Schema.Types.ObjectId | null;
    reporter: Schema.Types.ObjectId;
    reason: EReportReason;
    details: string | null;
    /**
     * The reported text as it read when reported. The author can delete their post
     * before anyone reviews it; without this the queue shows an empty row and the
     * report cannot be judged.
     */
    snapshot: string;
    /**
     * The turn that produced the reported content, where one exists — for an AI report,
     * the user's own message. A reviewer cannot judge an answer without the question,
     * but this is her health disclosure, so it is captured separately from `snapshot`
     * rather than concatenated into it, and the app says plainly that it is being sent.
     */
    contextSnapshot: string | null;
    status: EReportStatus;
    reviewedBy: Schema.Types.ObjectId | null;
    reviewedAt: Date | null;
    reviewerNote: string | null;
    createdAt: Date;
    updatedAt: Date;
}
