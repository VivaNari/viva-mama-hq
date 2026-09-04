import { Model, Types } from "mongoose";

import messageModel from "../../models/message.model";
import reportModel from "../../models/report.model";
import UserModel from "../../models/user.model";
import VivaClubCommentModel from "../../models/vivaClubComment.model";
import VivaClubPostModel from "../../models/vivaClubPost.model";
import { MessageRoleEnum, MessageTypeEnum } from "../../types/chat.types";
import {
    ACTIONABLE_CONTENT_TYPES,
    AUTO_HIDE_REPORT_THRESHOLD,
    EModerationStatus,
    EReportAction,
    EReportReason,
    EReportStatus,
    EReportTargetType,
    IModerationState,
} from "../../types/moderation.types";
import logger from "../../utils/logger";

/**
 * The shape both reportable content types share. Posts and comments have different
 * schemas, but everything moderation touches is common to both, so the service works
 * against this rather than branching per type.
 */
interface IReportableContent {
    _id: Types.ObjectId;
    user?: Types.ObjectId;
    content?: string;
    moderation?: IModerationState;
}

/** Content targets this service can resolve. AI_MESSAGE is reserved for B5. */
const CONTENT_MODELS: Partial<Record<EReportTargetType, Model<any>>> = {
    [EReportTargetType.VIVA_CLUB_POST]: VivaClubPostModel,
    [EReportTargetType.VIVA_CLUB_COMMENT]: VivaClubCommentModel,
};

const findContent = async (
    model: Model<any>,
    id: string,
): Promise<IReportableContent | null> =>
    model.findById(id).lean<IReportableContent | null>().exec();

export class ModerationError extends Error {
    constructor(
        message: string,
        public readonly code: "NOT_FOUND" | "FORBIDDEN" | "UNSUPPORTED" | "RATE_LIMITED",
    ) {
        super(message);
    }
}

/**
 * AI reports one user may file per day.
 *
 * The unique {targetType, targetId, reporter} index already stops the same message being
 * reported twice, but nothing stops someone walking their whole history flagging every
 * reply. A queue a human reads is only useful while a human can keep up with it.
 */
export const AI_REPORTS_PER_DAY = 20;

/**
 * Mongo filter for "content a reader is allowed to see".
 *
 * Written as a negative match on purpose. Every post and comment created before
 * moderation existed has no `moderation` key at all, so `{"moderation.status":"VISIBLE"}`
 * would match none of them and empty the feed. `$nin` on a missing field is true, which
 * is exactly the behaviour wanted for legacy rows.
 */
export const visibleContentFilter = () => ({
    "moderation.status": {
        $nin: [EModerationStatus.AUTO_HIDDEN, EModerationStatus.REMOVED],
    },
});

/**
 * Users whose content must not be shown to `userId`, in either direction.
 *
 * Both directions matter. If blocking only hid the blocked user's content from the
 * blocker, someone being harassed would lose sight of their harasser while the
 * harasser kept a clear view of them — the opposite of what blocking is for.
 */
export async function invisibleAuthorsFor(userId: unknown): Promise<Types.ObjectId[]> {
    if (!userId) return [];
    const _id = new Types.ObjectId(String(userId));

    const [me, blockedMe] = await Promise.all([
        UserModel.findById(_id).select("blockedUsers").lean(),
        UserModel.find({ blockedUsers: _id }).select("_id").lean(),
    ]);

    // Both casts go via `unknown` deliberately. IUser declares id fields as
    // `Schema.Types.ObjectId` — the schema type *constructor*, per the convention
    // documented on TObjectIdLike in subscription.types.ts — while the value a document
    // actually carries at runtime is a `Types.ObjectId`. The two do not structurally
    // overlap, so TypeScript refuses the direct cast.
    return [
        ...((me?.blockedUsers ?? []) as unknown as Types.ObjectId[]),
        ...(blockedMe.map((u) => u._id) as unknown as Types.ObjectId[]),
    ];
}

export class ModerationService {
    /**
     * Flag a Viva AI reply.
     *
     * Kept apart from `report()` rather than folded into it, because almost none of that
     * method's reasoning applies here:
     *
     *  - **Ownership must be checked, and nothing checks it for free.** `messages.userId`
     *    is a plain String, not a ref, so the generic path's `target.user` is `undefined`
     *    and its self-report guard silently passes. Without an explicit check, `snapshot`
     *    would copy someone else's private health conversation into a collection an
     *    administrator reads.
     *  - **The auto-hide threshold is meaningless.** An AI reply is one half of a private
     *    conversation; no second person can ever report the same message, so counting
     *    distinct reporters would never reach three and the count would only mislead.
     *  - **There is no author to record.** `targetAuthor` stays null, which is what makes
     *    BAN_AUTHOR inapplicable later.
     *
     * Every refusal is NOT_FOUND, including "this message is not yours". FORBIDDEN would
     * confirm the id exists, which is most of what an enumeration attempt wants to learn.
     */
    public async reportAiMessage(input: {
        reporterId: unknown;
        messageId: string;
        reason: EReportReason;
        details?: string | null;
    }): Promise<{ alreadyReported: boolean }> {
        const message = await messageModel
            .findById(input.messageId)
            .select("userId role type text conversationId createdAt")
            .lean();

        const isOwnAssistantMessage =
            message &&
            String(message.userId) === String(input.reporterId) &&
            message.role === MessageRoleEnum.ASSITANT &&
            message.type === MessageTypeEnum.AI;

        if (!isOwnAssistantMessage) {
            throw new ModerationError("Message not found", "NOT_FOUND");
        }

        const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const recent = await reportModel.countDocuments({
            reporter: new Types.ObjectId(String(input.reporterId)),
            targetType: EReportTargetType.AI_MESSAGE,
            createdAt: { $gte: since },
        });
        if (recent >= AI_REPORTS_PER_DAY) {
            throw new ModerationError(
                "You have reported a lot of messages today. Please try again tomorrow.",
                "RATE_LIMITED",
            );
        }

        // The question that produced the answer. A reviewer judging "was this reply
        // harmful?" cannot do it from the reply alone, and tuning the prompt needs the
        // prompt. The app tells her this is included before she sends it.
        const precedingUserTurn = await messageModel
            .findOne({
                conversationId: message.conversationId,
                role: MessageRoleEnum.USER,
                createdAt: { $lt: message.createdAt },
            })
            .sort({ createdAt: -1 })
            .select("text")
            .lean();

        try {
            await reportModel.create({
                targetType: EReportTargetType.AI_MESSAGE,
                targetId: new Types.ObjectId(input.messageId),
                targetAuthor: null,
                reporter: new Types.ObjectId(String(input.reporterId)),
                reason: input.reason,
                details: input.details ?? null,
                snapshot: String(message.text ?? "").slice(0, 2000),
                contextSnapshot: precedingUserTurn
                    ? String(precedingUserTurn.text ?? "").slice(0, 2000)
                    : null,
            });
        } catch (error: any) {
            // Same idempotency shape as community reports: a repeat is what the user
            // wanted to happen anyway, so telling them it failed would be a lie.
            if (error?.code === 11000) {
                return { alreadyReported: true };
            }
            throw error;
        }

        logger.info(
            { messageId: input.messageId, reason: input.reason },
            "AI message reported",
        );

        return { alreadyReported: false };
    }

    /**
     * Record a report and hide the content once enough distinct people have sent one.
     *
     * Returns `alreadyReported` rather than throwing on a repeat: the unique index makes
     * a second report from the same user impossible, and surfacing that as an error
     * would tell the reporter their tap failed when the outcome they wanted is already
     * in place.
     */
    public async report(input: {
        reporterId: unknown;
        targetType: EReportTargetType;
        targetId: string;
        reason: EReportReason;
        details?: string | null;
    }): Promise<{ alreadyReported: boolean; hidden: boolean }> {
        const model = CONTENT_MODELS[input.targetType];
        if (!model) {
            throw new ModerationError(
                `${input.targetType} cannot be reported yet`,
                "UNSUPPORTED",
            );
        }

        const target = await findContent(model, input.targetId);
        if (!target) {
            throw new ModerationError("Reported content no longer exists", "NOT_FOUND");
        }

        // Reporting yourself is meaningless, and it is not harmless: three self-reports
        // are indistinguishable from three real ones at the threshold, so without this
        // an author could hide their own post and occupy a reviewer with it. Deleting
        // is the action they actually want, and they already have it.
        if (target.user && String(target.user) === String(input.reporterId)) {
            throw new ModerationError("You cannot report your own content", "FORBIDDEN");
        }

        try {
            await reportModel.create({
                targetType: input.targetType,
                targetId: new Types.ObjectId(input.targetId),
                targetAuthor: target.user ?? null,
                reporter: new Types.ObjectId(String(input.reporterId)),
                reason: input.reason,
                details: input.details ?? null,
                // Captured now, because the author can delete this before review.
                snapshot: String(target.content ?? "").slice(0, 2000),
            });
        } catch (error: any) {
            if (error?.code === 11000) {
                return { alreadyReported: true, hidden: false };
            }
            throw error;
        }

        // Counted from the reports collection rather than $inc'd, so the number always
        // matches the number of distinct reporters even if a report row is ever removed.
        const reportCount = await reportModel.countDocuments({
            targetType: input.targetType,
            targetId: new Types.ObjectId(input.targetId),
        });

        const shouldHide =
            reportCount >= AUTO_HIDE_REPORT_THRESHOLD &&
            target.moderation?.status !== EModerationStatus.REMOVED;

        await model.updateOne(
            { _id: input.targetId },
            {
                $set: {
                    "moderation.reportCount": reportCount,
                    ...(shouldHide
                        ? {
                              "moderation.status": EModerationStatus.AUTO_HIDDEN,
                              "moderation.hiddenAt": new Date(),
                          }
                        : {}),
                },
            },
        );

        if (shouldHide) {
            logger.warn(
                { targetType: input.targetType, targetId: input.targetId, reportCount },
                "Content auto-hidden pending review",
            );
        }

        return { alreadyReported: false, hidden: shouldHide };
    }

    /**
     * Delete content the caller wrote.
     *
     * Removing a post takes its comments with it — the same cascade the account
     * deletion performs, and for the same reason: a comment whose post is gone is
     * unreachable but still stored.
     */
    public async deleteOwnContent(input: {
        userId: unknown;
        targetType: EReportTargetType;
        targetId: string;
    }): Promise<void> {
        const model = CONTENT_MODELS[input.targetType];
        if (!model) {
            throw new ModerationError("Unsupported content type", "UNSUPPORTED");
        }

        const target = await findContent(model, input.targetId);
        if (!target) {
            throw new ModerationError("Content not found", "NOT_FOUND");
        }
        if (String(target.user) !== String(input.userId)) {
            throw new ModerationError("You can only delete your own content", "FORBIDDEN");
        }

        if (input.targetType === EReportTargetType.VIVA_CLUB_POST) {
            await VivaClubCommentModel.deleteMany({ post: target._id });
        }
        await model.deleteOne({ _id: target._id });
    }

    /** Block or unblock another user. Self-blocking is rejected as a no-op mistake. */
    public async setBlocked(
        userId: unknown,
        targetUserId: string,
        blocked: boolean,
    ): Promise<void> {
        if (String(userId) === String(targetUserId)) {
            throw new ModerationError("You cannot block yourself", "FORBIDDEN");
        }
        const target = await UserModel.exists({ _id: targetUserId });
        if (!target) {
            throw new ModerationError("User not found", "NOT_FOUND");
        }

        await UserModel.updateOne(
            { _id: userId },
            blocked
                ? { $addToSet: { blockedUsers: new Types.ObjectId(targetUserId) } }
                : { $pull: { blockedUsers: new Types.ObjectId(targetUserId) } },
        );
    }

    /** Admin queue. SELF_HARM first — it is a welfare signal, not a content complaint. */
    public async listReports(params: {
        status?: EReportStatus;
        targetType?: EReportTargetType;
        page: number;
        limit: number;
    }) {
        const filter: Record<string, unknown> = {};
        if (params.status) filter.status = params.status;
        if (params.targetType) filter.targetType = params.targetType;

        const [rows, total] = await Promise.all([
            reportModel
                .aggregate([
                    { $match: filter },
                    {
                        $addFields: {
                            priority: {
                                $cond: [{ $eq: ["$reason", EReportReason.SELF_HARM] }, 0, 1],
                            },
                        },
                    },
                    { $sort: { priority: 1, createdAt: 1 } },
                    { $skip: (params.page - 1) * params.limit },
                    { $limit: params.limit },
                ])
                .exec(),
            reportModel.countDocuments(filter),
        ]);

        const populated = await reportModel.populate(rows, [
            { path: "reporter", select: "onboarding_data.preferred_name mobile_number email" },
            {
                path: "targetAuthor",
                select: "onboarding_data.preferred_name mobile_number email communityBanned",
            },
        ]);

        return {
            reports: populated,
            pagination: {
                currentPage: params.page,
                totalPages: Math.ceil(total / params.limit) || 1,
                total,
            },
        };
    }

    /**
     * Apply a reviewer's decision.
     *
     * REMOVE marks the content rather than deleting it: an appeal, or a question about
     * why something disappeared, cannot be answered from a row that no longer exists.
     */
    public async actionReport(input: {
        reportId: string;
        action: EReportAction;
        reviewerId: unknown;
        note?: string | null;
    }) {
        const report = await reportModel.findById(input.reportId);
        if (!report) {
            throw new ModerationError("Report not found", "NOT_FOUND");
        }

        // Content actions only mean something where there is shared content to act on.
        // An AI reply is half of a private conversation: nothing to hide from anyone
        // else, and no author to ban. Refused rather than ignored — silently succeeding
        // would tell a reviewer they had removed something that is still there.
        const changesContent =
            input.action === EReportAction.REMOVE || input.action === EReportAction.BAN_AUTHOR;
        if (changesContent && !ACTIONABLE_CONTENT_TYPES.includes(report.targetType)) {
            throw new ModerationError(
                `${input.action} does not apply to ${report.targetType}`,
                "UNSUPPORTED",
            );
        }

        const model = CONTENT_MODELS[report.targetType];

        if (input.action === EReportAction.REMOVE && model) {
            await model.updateOne(
                { _id: report.targetId },
                {
                    $set: {
                        "moderation.status": EModerationStatus.REMOVED,
                        "moderation.hiddenAt": new Date(),
                    },
                },
            );
        }

        if (input.action === EReportAction.DISMISS && model) {
            // Restore visibility and reset the count, otherwise the next single report
            // would re-trip a threshold a human has already judged not to apply.
            await model.updateOne(
                { _id: report.targetId },
                {
                    $set: {
                        "moderation.status": EModerationStatus.VISIBLE,
                        "moderation.reportCount": 0,
                        "moderation.hiddenAt": null,
                    },
                },
            );
            await reportModel.updateMany(
                { targetType: report.targetType, targetId: report.targetId },
                { $set: { status: EReportStatus.DISMISSED } },
            );
        }

        if (input.action === EReportAction.BAN_AUTHOR) {
            if (!report.targetAuthor) {
                throw new ModerationError("This report has no author to ban", "NOT_FOUND");
            }
            await UserModel.updateOne(
                { _id: report.targetAuthor },
                { $set: { communityBanned: true } },
            );
            if (model) {
                await model.updateOne(
                    { _id: report.targetId },
                    {
                        $set: {
                            "moderation.status": EModerationStatus.REMOVED,
                            "moderation.hiddenAt": new Date(),
                        },
                    },
                );
            }
        }

        report.status =
            input.action === EReportAction.DISMISS
                ? EReportStatus.DISMISSED
                : EReportStatus.ACTIONED;
        report.reviewedBy = new Types.ObjectId(String(input.reviewerId)) as never;
        report.reviewedAt = new Date();
        report.reviewerNote = input.note ?? null;
        await report.save();

        return report;
    }
}

export const moderationService = new ModerationService();
