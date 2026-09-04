import { Types } from "mongoose";

import aiMessageBookmarkModel from "../../models/ai-message-bookmark.model";
import analyticsEventModel from "../../models/analytics-event.model";
import consultationCreditModel from "../../models/consultation-credit.model";
import consultationReviewModel from "../../models/consultation-review.model";
import consultationModel from "../../models/consultation.model";
import conversationModel from "../../models/conversation.model";
import flowInstanceModel from "../../models/flowInstance.model";
import flowResponseModel from "../../models/flowResponse.model";
import messageModel from "../../models/message.model";
import moodLogModel from "../../models/mood-log.model";
import recommendationHistoryModel from "../../models/recommendation-history.model";
import reportModel from "../../models/report.model";
import subscriptionModel from "../../models/subscription.model";
import referralRedemptionModel from "../../models/referral-redemption.model";
import supportModel from "../../models/support.model";
import usageCounterModel from "../../models/usage-counter.model";
import UserModel from "../../models/user.model";
import VivaClubCommentModel from "../../models/vivaClubComment.model";
import VivaClubPostModel from "../../models/vivaClubPost.model";
import logger from "../../utils/logger";
import { getBillingProvider } from "../subscription/billing";
import { ISubscription } from "../../types/subscription.types";

/**
 * How many documents were removed, per collection. Returned to the caller and logged,
 * so a deletion can be evidenced if a user or a regulator asks what was erased.
 */
export type TDeletionReport = Record<string, number>;

/**
 * Erases a user account and everything derived from it.
 *
 * Play's User Data policy requires an in-app path to delete the account *and* its
 * associated data, so this is a genuine erase rather than a disable flag. The only
 * things deliberately left behind are financial records — see RETAINED below.
 *
 * **No transaction.** This deployment runs a standalone MongoDB, and multi-document
 * transactions require a replica set, so there is nothing to roll back to if a step
 * throws. Two things make that safe:
 *
 *  1. The user document is deleted **last**. Every earlier step is keyed on a user id
 *     that still resolves, so a failure part-way leaves the account intact and the
 *     whole operation can simply be retried — idempotently, because every step is a
 *     `deleteMany` that matches nothing the second time.
 *  2. Dependents are removed before the rows they hang off, so a crash cannot strand
 *     a child row whose parent id has already gone.
 *
 * Deleting the user first would invert both properties: a mid-way crash would orphan
 * data permanently, with no id left to find it by.
 */
export class AccountDeletionService {
    /**
     * Financial records are kept. Indian tax and companies legislation requires books
     * and payment records to be retained for years after the transaction, and the Play
     * policy explicitly permits retaining what law requires provided the privacy policy
     * says so. These rows key on an ObjectId that no longer resolves to a person, and
     * carry no name, contact detail or health information.
     *
     * These are **collection** names, not model names — Mongoose lowercases what you
     * pass to `model()` when deriving the collection, so the orders model registered as
     * `bookConsultation_orders` actually lives in `bookconsultation_orders`. The
     * coverage test in `__tests__/accountDeletion.test.ts` compares against
     * `model.collection.name`, so a model name here would silently fail to match.
     */
    public static readonly RETAINED = ["payment_orders", "bookconsultation_orders"] as const;

    public async deleteAccount(userId: Types.ObjectId | string): Promise<TDeletionReport> {
        const _id = new Types.ObjectId(userId);
        const report: TDeletionReport = {};

        const record = async (key: string, run: () => Promise<{ deletedCount?: number }>) => {
            const result = await run();
            report[key] = result?.deletedCount ?? 0;
        };

        // ── Resolve dependent ids before anything is removed ──────────────────────
        // Each of these parents is deleted below; their children are keyed on the
        // parent id, not on the user, so the ids have to be captured while they exist.
        const [flowInstanceIds, consultationIds, postIds] = await Promise.all([
            flowInstanceModel.find({ userId: _id }).distinct("_id"),
            consultationModel.find({ userId: _id }).distinct("_id"),
            VivaClubPostModel.find({ user: _id }).distinct("_id"),
        ]);

        // ── Guided flows: answers, then the instances that own them ───────────────
        await record("flow_responses", () =>
            flowResponseModel.deleteMany({ flowInstanceId: { $in: flowInstanceIds } }),
        );
        await record("flow_instances", () => flowInstanceModel.deleteMany({ userId: _id }));

        // ── Consultations: reviews reference the consultation, not the user ───────
        await record("consultation_reviews", () =>
            consultationReviewModel.deleteMany({ consultationId: { $in: consultationIds } }),
        );
        await record("consultations", () => consultationModel.deleteMany({ userId: _id }));

        // ── Entitlements ─────────────────────────────────────────────────────────
        await record("consultation_credits", () =>
            consultationCreditModel.deleteMany({ user_id: _id }),
        );
        await record("usage_counters", () => usageCounterModel.deleteMany({ user_id: _id }));

        // Stop billing BEFORE the rows that say how to stop it are deleted (M10).
        //
        // Without this the sweep erases every trace of the subscription while the
        // mandate at the provider stays live: the card keeps being charged, and the
        // resulting webhook is dropped as "unknown subscription", so money moves and
        // nothing records why. Harmless while BILLING_MODE was MANUAL, which has no
        // mandate at all — a live billing and data-protection bug the moment a
        // renewing rail exists, which Play now makes true.
        //
        // Each cancel resolves the provider from the ROW's billingMode, never the env:
        // a user can hold a Razorpay row while new subscriptions are sold through Play.
        const liveSubscriptions = (await subscriptionModel
            .find({ user_id: _id })
            .lean()) as unknown as ISubscription[];

        for (const subscription of liveSubscriptions) {
            try {
                await getBillingProvider(subscription.billingMode).cancel(subscription);
            } catch (error) {
                // Deliberately not fatal. A provider outage must not block a deletion
                // request the user is entitled to — but it does need to be visible,
                // because it means a mandate may still be live with no local record.
                logger.error(
                    {
                        err: error,
                        subscriptionId: String(subscription._id),
                        billingMode: subscription.billingMode,
                    },
                    "Account deletion: provider cancel failed; a live mandate may remain",
                );
            }
        }

        await record("subscriptions", () => subscriptionModel.deleteMany({ user_id: _id }));
        // The ledger row is personal data — it names who redeemed a partner's code — so
        // it goes with the account.
        //
        // The SEAT IS NOT RELEASED, deliberately. It was spent: she held the granted
        // subscription for as long as she had the account, and the organization got what
        // it paid for. Giving it back would also make delete-and-re-register a way to
        // draw an unlimited number of seats from a finite pool.
        await record("referral_redemptions", () =>
            referralRedemptionModel.deleteMany({ user_id: _id }),
        );

        // ── Chat ─────────────────────────────────────────────────────────────────
        await record("messages", () => messageModel.deleteMany({ userId: _id }));
        await record("conversations", () => conversationModel.deleteMany({ userId: _id }));
        await record("ai_message_bookmarks", () =>
            aiMessageBookmarkModel.deleteMany({ userId: _id }),
        );

        // ── Health logs and derived content ──────────────────────────────────────
        await record("mood_logs", () => moodLogModel.deleteMany({ userId: _id }));
        await record("recommendation_history", () =>
            recommendationHistoryModel.deleteMany({ userId: _id }),
        );

        await record("supports", () => supportModel.deleteMany({ userId: _id }));
        await record("analytics_events", () => analyticsEventModel.deleteMany({ user_id: _id }));

        // ── Community ────────────────────────────────────────────────────────────
        // Comments the user left elsewhere, then every comment on the posts about to
        // be removed — including other people's, which would otherwise be stranded
        // pointing at a post id that no longer exists.
        await record("viva_club_comments_by_user", () =>
            VivaClubCommentModel.deleteMany({ user: _id }),
        );
        await record("viva_club_comments_on_deleted_posts", () =>
            VivaClubCommentModel.deleteMany({ post: { $in: postIds } }),
        );
        await record("viva_club_posts", () => VivaClubPostModel.deleteMany({ user: _id }));

        // Reports this user filed. Reports *about* their content are removed separately
        // below — the content is going, so a queue entry pointing at it would be
        // unreviewable, and leaving it would keep a copy of the deleted text in
        // `snapshot` after the account was erased.
        await record("reports_filed", () => reportModel.deleteMany({ reporter: _id }));
        await record("reports_about_their_content", () =>
            reportModel.deleteMany({ targetAuthor: _id }),
        );

        // Likes are an array of user ids embedded on *other people's* posts, so they
        // survive the deletes above and have to be pulled out explicitly.
        const likes = await VivaClubPostModel.updateMany({ likes: _id }, { $pull: { likes: _id } });
        report.viva_club_likes_removed = likes.modifiedCount ?? 0;

        // ── Inbound references from other accounts ───────────────────────────────
        // Blocks are the same shape of problem as likes: an array of user ids embedded
        // on *other people's* documents. Nothing above touches them, so without this
        // every account that ever blocked this user keeps their id forever — a stored
        // reference to a person who asked to be erased, on a row we never delete.
        const blocks = await UserModel.updateMany(
            { blockedUsers: _id },
            { $pull: { blockedUsers: _id } },
        );
        report.blocks_removed = blocks.modifiedCount ?? 0;

        // A referrer points at this user by ObjectId and by the numeric user_id. Both
        // are cleared, or the referring account keeps a dangling pointer to a person
        // who no longer exists.
        const user = await UserModel.findById(_id).select("user_id").lean();
        const referrals = await UserModel.updateMany(
            { referred_user_object_id: _id },
            { $set: { referred_user_object_id: null, referred_user_id: null } },
        );
        report.referral_links_cleared = referrals.modifiedCount ?? 0;
        if (user?.user_id) {
            const byNumericId = await UserModel.updateMany(
                { referred_user_id: user.user_id },
                { $set: { referred_user_id: null } },
            );
            report.referral_links_cleared += byNumericId.modifiedCount ?? 0;
        }

        // ── NOT YET COVERED: the external LLM ────────────────────────────────────
        // Chat is proxied to LLM_SERVER_URL keyed by this same user id, and that service
        // exposes no delete endpoint (see services/llm/llm.service.ts). Until it does,
        // deletion is complete in this database but not necessarily at the provider, so
        // the claim "we delete your data" is only as true as their retention policy.
        // Closing this needs a purge endpoint on the RAG service and a call here.
        logger.warn(
            { userId: _id.toString() },
            "Account deleted locally; LLM-side conversation history was NOT purged — no purge endpoint exists",
        );

        // ── The account itself, last ─────────────────────────────────────────────
        // Embedded `childs`, onboarding answers, consents and the FCM token all live
        // on this document and go with it.
        await record("users", () => UserModel.deleteOne({ _id }));

        logger.info({ userId: _id.toString(), report }, "Account deleted");

        return report;
    }
}

export const accountDeletionService = new AccountDeletionService();
