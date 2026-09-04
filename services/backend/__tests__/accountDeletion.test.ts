jest.mock(require.resolve("../src/config/firebase"), () => ({ __esModule: true, default: null }));
jest.mock(require.resolve("../src/config/redis.config"), () => ({ __esModule: true }));

import fs from "fs";
import path from "path";

import mongoose, { Types } from "mongoose";

import { clearTestDb, closeTestDb, connectTestDb } from "./helpers/db";
import aiMessageBookmarkModel from "../src/models/ai-message-bookmark.model";
import analyticsEventModel from "../src/models/analytics-event.model";
import consultationCreditModel from "../src/models/consultation-credit.model";
import consultationReviewModel from "../src/models/consultation-review.model";
import consultationModel from "../src/models/consultation.model";
import conversationModel from "../src/models/conversation.model";
import flowInstanceModel from "../src/models/flowInstance.model";
import flowResponseModel from "../src/models/flowResponse.model";
import messageModel from "../src/models/message.model";
import moodLogModel from "../src/models/mood-log.model";
import recommendationHistoryModel from "../src/models/recommendation-history.model";
import reportModel from "../src/models/report.model";
import subscriptionModel from "../src/models/subscription.model";
import supportModel from "../src/models/support.model";
import usageCounterModel from "../src/models/usage-counter.model";
import UserModel from "../src/models/user.model";
import VivaClubCommentModel from "../src/models/vivaClubComment.model";
import VivaClubPostModel from "../src/models/vivaClubPost.model";
import { AccountDeletionService } from "../src/services/users/account-deletion.service";
import {
    EBillingMode,
    EBillingProvider,
    ECreditReason,
    ECreditType,
    EUsageCounterKey,
    ESubscriptionStatus,
    ESubscriptionTier,
} from "../src/types/subscription.types";
import { EAnalyticsEvent } from "../src/types/analytics.types";
import { EReportReason, EReportTargetType } from "../src/types/moderation.types";
import { ConsultationTypeEnum } from "../src/types/consultation.types";

jest.setTimeout(120000);

const service = new AccountDeletionService();

beforeAll(connectTestDb);
afterAll(closeTestDb);
afterEach(clearTestDb);

/**
 * Seeds one account with a row in every collection the deletion sweeps, plus a second
 * untouched account. Returns both ids so each test can assert the victim is gone *and*
 * the bystander is intact — a `deleteMany` with a mistyped key would wipe both.
 */
async function seed() {
    const victim = await UserModel.create({
        email: "victim@example.com",
        mobile_number: "9990000001",
        childs: [{ name: "Baby", date_of_birth: new Date("2025-01-01"), sex: "Female" }],
        FCM_token: "fcm-victim",
    });
    const bystander = await UserModel.create({
        email: "bystander@example.com",
        mobile_number: "9990000002",
    });

    const uid = victim._id as unknown as Types.ObjectId;
    const bid = bystander._id as unknown as Types.ObjectId;

    const flowInstance = await flowInstanceModel.create({ userId: uid });
    await flowResponseModel.create({
        flowInstanceId: flowInstance._id,
        flowDefId: new Types.ObjectId(),
    });

    const consultation = await consultationModel.create({
        userId: uid,
        consultationType: ConsultationTypeEnum.EXPERT,
        consultatorId: new Types.ObjectId(),
        preferred_consultation_date: new Date(),
    });
    await consultationReviewModel.create({ consultationId: consultation._id, rating: 5 });

    await consultationCreditModel.create({
        user_id: uid,
        subscription_id: new Types.ObjectId(),
        type: ECreditType.EXPERT,
        seq: 1,
        delta: 1,
        balanceAfter: 1,
        reason: ECreditReason.GRANT,
        expiresAt: new Date(Date.now() + 86400000),
    });
    await usageCounterModel.create({
        user_id: uid,
        key: EUsageCounterKey.AI_MESSAGE,
        windowKey: "2026-08-09",
        count: 1,
        expiresAt: new Date(Date.now() + 86400000),
    });
    await subscriptionModel.create({
        user_id: uid,
        isCurrent: true,
        tier: ESubscriptionTier.PREMIUM,
        status: ESubscriptionStatus.ACTIVE,
        billingMode: EBillingMode.MANUAL,
        provider: EBillingProvider.RAZORPAY_ORDERS,
    });
    await conversationModel.create({ userId: uid });
    await messageModel.create({ userId: uid, text: "hello" });
    await aiMessageBookmarkModel.create({ userId: uid, messageId: new Types.ObjectId() });
    await moodLogModel.create({ userId: uid, mood: 3, logDate: new Date() });
    // Inserted through the driver rather than the model: a valid recommendation
    // history needs a deep tree of per-category scores and copy, none of which the
    // deletion looks at. All that matters here is a row in the right collection
    // carrying the right user key.
    await recommendationHistoryModel.collection.insertOne({ userId: uid } as never);
    await supportModel.create({ userId: uid, supportType: "general", message: "help" });
    await analyticsEventModel.create({ user_id: uid, event: EAnalyticsEvent.SUBSCRIPTION_ACTIVATED });

    // Community: the victim's own post (liked by the bystander), a bystander comment on
    // that post, the victim's comment on a bystander post, and a bystander post the
    // victim liked.
    const victimPost = await VivaClubPostModel.create({ user: uid, content: "mine", likes: [bid] });
    const bystanderPost = await VivaClubPostModel.create({
        user: bid,
        content: "theirs",
        likes: [uid],
    });
    await VivaClubCommentModel.create({ post: victimPost._id, user: bid, content: "theirs" });
    await VivaClubCommentModel.create({ post: bystanderPost._id, user: uid, content: "mine" });

    // The bystander was referred by the victim, by both pointer shapes.
    await UserModel.updateOne(
        { _id: bid },
        { $set: { referred_user_object_id: uid, referred_user_id: victim.user_id } },
    );

    return { uid, bid, bystanderPost };
}

describe("AccountDeletionService", () => {
    it("removes the user and every collection keyed to them", async () => {
        const { uid } = await seed();

        await service.deleteAccount(uid);

        expect(await UserModel.countDocuments({ _id: uid })).toBe(0);
        expect(await flowResponseModel.countDocuments({})).toBe(0);
        expect(await flowInstanceModel.countDocuments({ userId: uid })).toBe(0);
        expect(await consultationReviewModel.countDocuments({})).toBe(0);
        expect(await consultationModel.countDocuments({ userId: uid })).toBe(0);
        expect(await consultationCreditModel.countDocuments({ user_id: uid })).toBe(0);
        expect(await usageCounterModel.countDocuments({ user_id: uid })).toBe(0);
        expect(await subscriptionModel.countDocuments({ user_id: uid })).toBe(0);
        expect(await conversationModel.countDocuments({ userId: uid })).toBe(0);
        expect(await messageModel.countDocuments({ userId: uid })).toBe(0);
        expect(await aiMessageBookmarkModel.countDocuments({ userId: uid })).toBe(0);
        expect(await moodLogModel.countDocuments({ userId: uid })).toBe(0);
        expect(await recommendationHistoryModel.countDocuments({ userId: uid })).toBe(0);
        expect(await supportModel.countDocuments({ userId: uid })).toBe(0);
        expect(await analyticsEventModel.countDocuments({ user_id: uid })).toBe(0);
        expect(await VivaClubPostModel.countDocuments({ user: uid })).toBe(0);
        expect(await VivaClubCommentModel.countDocuments({ user: uid })).toBe(0);
    });

    it("leaves other accounts and their content intact", async () => {
        const { uid, bid, bystanderPost } = await seed();

        await service.deleteAccount(uid);

        expect(await UserModel.countDocuments({ _id: bid })).toBe(1);
        expect(await VivaClubPostModel.countDocuments({ _id: bystanderPost._id })).toBe(1);
    });

    it("cascades comments left by others on the deleted user's posts", async () => {
        const { uid } = await seed();

        await service.deleteAccount(uid);

        // The bystander's comment lived on the victim's post. Deleting only comments
        // authored by the victim would strand it pointing at a post that no longer
        // exists, which is what the second delete in the service guards against.
        expect(await VivaClubCommentModel.countDocuments({})).toBe(0);
    });

    it("pulls the deleted user out of other people's like arrays", async () => {
        const { uid, bystanderPost } = await seed();

        await service.deleteAccount(uid);

        const post = await VivaClubPostModel.findById(bystanderPost._id).lean();
        expect(post?.likes ?? []).toHaveLength(0);
    });

    // Blocks are embedded on *other people's* user documents — the same shape as likes,
    // and the same reason they need pulling explicitly. Added with B4; without it a
    // deleted account's id survives on every row that ever blocked it.
    it("pulls the deleted user out of other people's block lists", async () => {
        const { uid, bid } = await seed();

        await UserModel.updateOne({ _id: bid }, { $addToSet: { blockedUsers: uid } });

        await service.deleteAccount(uid);

        const bystander = await UserModel.findById(bid).select("blockedUsers").lean();
        expect(bystander?.blockedUsers ?? []).toHaveLength(0);
    });

    // Reports a user filed about Viva AI carry her own conversation text in `snapshot`
    // and `contextSnapshot`. The coverage guard below detects unswept *collections* by
    // `ref: "users"`; it cannot notice a new *field* holding personal text inside a
    // collection that is already swept, so this is asserted directly.
    it("takes AI reports, and the conversation text inside them, with the account", async () => {
        const { uid } = await seed();

        await reportModel.create({
            targetType: EReportTargetType.AI_MESSAGE,
            targetId: new Types.ObjectId(),
            targetAuthor: null,
            reporter: uid,
            reason: EReportReason.HARMFUL_ADVICE,
            snapshot: "the reply she flagged",
            contextSnapshot: "HER OWN HEALTH QUESTION",
        });

        await service.deleteAccount(uid);

        expect(await reportModel.countDocuments({})).toBe(0);
    });

    it("clears inbound referral pointers on the referring account", async () => {
        const { uid, bid } = await seed();

        await service.deleteAccount(uid);

        const referrer = await UserModel.findById(bid).lean();
        expect(referrer?.referred_user_object_id).toBeNull();
        expect(referrer?.referred_user_id).toBeNull();
    });

    it("is idempotent — a retry after a partial failure is safe", async () => {
        const { uid } = await seed();

        await service.deleteAccount(uid);
        const second = await service.deleteAccount(uid);

        // Every step matches nothing the second time rather than throwing, which is what
        // makes "retry the whole thing" a valid recovery for a mid-way failure.
        expect(second.users).toBe(0);
        expect(second.messages).toBe(0);
    });

    it("reports what it deleted", async () => {
        const { uid } = await seed();

        const report = await service.deleteAccount(uid);

        expect(report.users).toBe(1);
        expect(report.messages).toBe(1);
        expect(report.flow_responses).toBe(1);
        expect(report.viva_club_likes_removed).toBe(1);
        expect(report.referral_links_cleared).toBeGreaterThanOrEqual(1);
    });

    it("retains financial records, which law requires be kept", async () => {
        expect(AccountDeletionService.RETAINED).toContain("payment_orders");
        expect(AccountDeletionService.RETAINED).toContain("bookconsultation_orders");
    });
});

/**
 * Guards the thing most likely to rot: someone adds a user-keyed collection and forgets
 * the deletion sweep, leaving personal data behind after an account is erased. This
 * reads the registered Mongoose schemas rather than a hand-maintained list, so a new
 * model fails the test on the day it is added.
 */
describe("deletion coverage", () => {
    // `mongoose.modelNames()` only lists models that something has imported, so relying
    // on this file's imports would let a brand-new model pass the check by being absent.
    // Loading the whole directory is the point: the guard has to see models nobody has
    // wired up yet, because those are exactly the ones that get forgotten.
    beforeAll(() => {
        const dir = path.join(__dirname, "..", "src", "models");
        for (const file of fs.readdirSync(dir)) {
            if (file.endsWith(".model.ts") || file === "flowNodeCategory.ts") {
                require(path.join(dir, file));
            }
        }
    });

    /**
     * Detection is by `ref: "users"`, not by field name.
     *
     * The first version of this guard matched a list of names — user, userId, user_id —
     * and silently passed when `reports` arrived keyed on `reporter` and `targetAuthor`.
     * A collection full of personal data was invisible to the check meant to find it.
     * A schema cannot point at a user without declaring the ref, so this asks the
     * question the right way round.
     */
    const userRefPaths = (schema: mongoose.Schema): string[] =>
        Object.entries(schema.paths)
            .filter(([, p]) => {
                const opts = (p as { options?: { ref?: string; type?: { ref?: string }[] } })
                    .options;
                return opts?.ref === "users" || opts?.type?.[0]?.ref === "users";
            })
            .map(([name]) => name);

    it("sweeps every registered collection that keys on a user", async () => {
        const SWEPT = new Set([
            "users", "flow_instances", "flow_responses", "consultations",
            "consultation_reviews", "consultation_credits", "usage_counters",
            "subscriptions", "conversations", "messages", "ai_message_bookmarks",
            "mood_logs", "recommendation_histories", "supports", "analytics_events",
            "viva_club_posts", "viva_club_comments", "reports",
            "referral_redemptions",
        ]);
        const RETAINED = new Set<string>(AccountDeletionService.RETAINED);

        const unhandled: string[] = [];
        for (const name of mongoose.modelNames()) {
            const model = mongoose.model(name);
            const collection = model.collection.name;
            // `messages` and `conversations` store the user id as a plain String with no
            // ref, so a ref-only check would miss them. Names still matter; they are just
            // no longer the only signal.
            const paths = Object.keys(model.schema.paths);
            const keysOnUser =
                userRefPaths(model.schema).length > 0 ||
                paths.some((p) => p === "user_id" || p === "userId" || p === "user");
            if (keysOnUser && !SWEPT.has(collection) && !RETAINED.has(collection)) {
                unhandled.push(`${name} (${collection})`);
            }
        }

        expect(unhandled).toEqual([]);
    });
});
