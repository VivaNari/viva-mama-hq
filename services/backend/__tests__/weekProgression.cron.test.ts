jest.mock(require.resolve("../src/config/firebase"), () => ({ __esModule: true, default: null }));
jest.mock(require.resolve("../src/config/redis.config"), () => ({ __esModule: true }));

const sendPushNotificationMock = jest.fn(async () => undefined);
jest.mock(require.resolve("../src/utils/sendPushNotification"), () => ({
    __esModule: true,
    sendPushNotification: (...args: unknown[]) => sendPushNotificationMock(...(args as [])),
}));

import { connectTestDb, closeTestDb, clearTestDb } from "./helpers/db";
import UserModel from "../src/models/user.model";
import flowDefinitionModel from "../src/models/flowDefinition.model";
import flowInstanceModel from "../src/models/flowInstance.model";
import { weekProgression } from "../src/cron-jobs/weekProgression";
import { pregnancyTransition } from "../src/cron-jobs/pregnancyTransition";
import { checkinNotification } from "../src/cron-jobs/checkinNotification";
import { WEEKLY_CHECKIN_SLUG } from "../src/constants/chat";
import { FlowInstanceStateEnum } from "../src/types/chat.types";
import { EUserCategory } from "../src/types/user.types";
import { ESubscriptionTier } from "../src/types/subscription.types";

jest.setTimeout(120000);

// 09:00 IST on 2026-07-29.
const NOW = new Date("2026-07-29T03:30:00.000Z");

const deliveredDaysAgo = (days: number): Date => new Date(NOW.getTime() - days * 86_400_000);

async function makeUser({
    daysPostpartum,
    deliveryDate,
    fcmToken = "fcm-token",
    tier = ESubscriptionTier.PREMIUM,
    category = EUserCategory.PP,
    onboarded = true,
}: {
    daysPostpartum?: number;
    deliveryDate?: Date;
    // null, not undefined: a destructuring default fires on undefined, which would
    // silently hand a token back to the very tests that exist to run without one.
    fcmToken?: string | null;
    tier?: ESubscriptionTier;
    category?: EUserCategory;
    onboarded?: boolean;
}) {
    return UserModel.create({
        mobile_number: `9${Math.floor(Math.random() * 1_000_000_000)}`,
        FCM_token: fcmToken,
        user_category: category,
        preferred_language: "en",
        is_onboarded: { is_questionnaire_completed: onboarded },
        onboarding_data: {
            delivery_date: deliveryDate ?? deliveredDaysAgo(daysPostpartum ?? 0),
        },
        subscription: {
            tier,
            // Far-future so resolveTier does not lapse it back to FREE.
            currentPeriodEnd: new Date("2027-01-01T00:00:00.000Z"),
            trialEndAt: new Date("2027-01-01T00:00:00.000Z"),
        },
    });
}

async function publishFlowDefinition() {
    return flowDefinitionModel.create({
        slug: WEEKLY_CHECKIN_SLUG,
        version: 1,
        status: "PUBLISHED",
        startNodeId: "q1",
        nodes: [{ id: "q1", nodeType: "SINGLE_CHOICE", text: "How are you?", options: [] }],
    });
}

const weekdaysOf = async (userId: unknown) => {
    const user = await UserModel.findById(userId).lean();
    return user!.current_weekdays;
};

beforeAll(connectTestDb);
afterAll(closeTestDb);
beforeEach(async () => {
    await clearTestDb();
    sendPushNotificationMock.mockClear();
});

describe("weekProgression", () => {
    it("advances a user who has no FCM token", async () => {
        // The old job filtered the user query on FCM_token, so declining push froze the
        // week, froze week-scoped content, and left upcoming_checkin_due_days at its
        // schema default of 0 — which permanently ENABLED the check-in button.
        await publishFlowDefinition();
        const user = await makeUser({ daysPostpartum: 15, fcmToken: null });

        await weekProgression(NOW);

        expect(await weekdaysOf(user._id)).toMatchObject({
            weeks: 3,
            days: 1,
            previous_checkin_due_days: 1,
            upcoming_checkin_due_days: 6,
        });
    });

    it("opens exactly one check-in for the current week", async () => {
        await publishFlowDefinition();
        const user = await makeUser({ daysPostpartum: 15 });

        const result = await weekProgression(NOW);

        expect(result.instancesCreated).toBe(1);

        const instances = await flowInstanceModel.find({ userId: user._id }).lean();
        expect(instances).toHaveLength(1);
        expect(instances[0]).toMatchObject({
            postpartumWeek: 3,
            flowSlug: WEEKLY_CHECKIN_SLUG,
            state: FlowInstanceStateEnum.PENDING,
        });
    });

    it("is idempotent — a repeated run creates nothing new", async () => {
        // Cloud Scheduler retries on a 500, so a second run of the same night must not
        // open a second check-in. The unique index is what guarantees it.
        await publishFlowDefinition();
        const user = await makeUser({ daysPostpartum: 15 });

        await weekProgression(NOW);
        const second = await weekProgression(NOW);

        expect(second.instancesCreated).toBe(0);
        expect(await flowInstanceModel.countDocuments({ userId: user._id })).toBe(1);
    });

    it("lands on the right week after missed runs instead of drifting", async () => {
        // The old job incremented from the last instance (`targetWeek = latest + 1`), so
        // skipping days put the numbering permanently behind. This recomputes absolutely.
        await publishFlowDefinition();
        const user = await makeUser({ daysPostpartum: 15 });

        await weekProgression(NOW);

        // Nothing runs for three weeks.
        const threeWeeksOn = new Date(NOW.getTime() + 21 * 86_400_000);
        await weekProgression(threeWeeksOn);

        expect(await weekdaysOf(user._id)).toMatchObject({ weeks: 6, days: 1 });

        const weeks = (await flowInstanceModel.find({ userId: user._id }).lean())
            .map((i) => i.postpartumWeek)
            .sort((a, b) => a - b);

        // Week 3 (from the first run) and week 6 (current). No phantom 4 and 5.
        expect(weeks).toEqual([3, 6]);
    });

    it("expires a check-in once its week has passed", async () => {
        await publishFlowDefinition();
        const user = await makeUser({ daysPostpartum: 15 });

        await weekProgression(NOW);
        await weekProgression(new Date(NOW.getTime() + 7 * 86_400_000));

        const week3 = await flowInstanceModel.findOne({ userId: user._id, postpartumWeek: 3 });
        expect(week3!.state).toBe(FlowInstanceStateEnum.EXPIRED);
    });

    it("lets a check-in that is already in progress survive the week boundary", async () => {
        // The job runs at 00:15. Expiring ACTIVE on the boundary would kill a
        // conversation someone was mid-way through — her next answer would come back
        // "expired" with the partial answers stranded.
        await publishFlowDefinition();
        const user = await makeUser({ daysPostpartum: 14 });
        await weekProgression(NOW);

        await flowInstanceModel.updateOne(
            { userId: user._id, postpartumWeek: 3 },
            { $set: { state: FlowInstanceStateEnum.ACTIVE } },
        );

        await weekProgression(new Date(NOW.getTime() + 7 * 86_400_000));

        const week3 = await flowInstanceModel.findOne({ userId: user._id, postpartumWeek: 3 });
        expect(week3!.state).toBe(FlowInstanceStateEnum.ACTIVE);
        expect(week3!.cursorNodeId).not.toBeNull();
    });

    it("eventually expires an abandoned in-progress check-in", async () => {
        await publishFlowDefinition();
        const user = await makeUser({ daysPostpartum: 14 });
        await weekProgression(NOW);
        await flowInstanceModel.updateOne(
            { userId: user._id, postpartumWeek: 3 },
            { $set: { state: FlowInstanceStateEnum.ACTIVE } },
        );

        // Two weeks on, the grace is over.
        await weekProgression(new Date(NOW.getTime() + 14 * 86_400_000));

        const week3 = await flowInstanceModel.findOne({ userId: user._id, postpartumWeek: 3 });
        expect(week3!.state).toBe(FlowInstanceStateEnum.EXPIRED);
    });

    it("still closes an untouched check-in on the boundary", async () => {
        // The grace is for work in progress only — PENDING means she never opened it.
        await publishFlowDefinition();
        const user = await makeUser({ daysPostpartum: 14 });
        await weekProgression(NOW);

        await weekProgression(new Date(NOW.getTime() + 7 * 86_400_000));

        const week3 = await flowInstanceModel.findOne({ userId: user._id, postpartumWeek: 3 });
        expect(week3!.state).toBe(FlowInstanceStateEnum.EXPIRED);
    });

    it("opens no check-in for a FREE user", async () => {
        // FREE has no check-in entitlement, so the row could never be opened — and the
        // notification job would have nudged her toward a feature she cannot use.
        await publishFlowDefinition();
        const user = await makeUser({ daysPostpartum: 15, tier: ESubscriptionTier.FREE });

        await weekProgression(NOW);

        expect(await flowInstanceModel.countDocuments({ userId: user._id })).toBe(0);
        // Her week still advances.
        expect(await weekdaysOf(user._id)).toMatchObject({ weeks: 3 });
    });

    it("advances a pregnant user's week without opening a check-in", async () => {
        await publishFlowDefinition();
        const user = await makeUser({
            deliveryDate: new Date(NOW.getTime() + 40 * 86_400_000),
            category: EUserCategory.NP,
        });

        await weekProgression(NOW);

        expect(await weekdaysOf(user._id)).toMatchObject({
            weeks: 34,
            upcoming_checkin_due_days: 0,
        });
        expect(await flowInstanceModel.countDocuments({ userId: user._id })).toBe(0);
    });

    it("skips a user who has not finished the questionnaire", async () => {
        await publishFlowDefinition();
        const user = await makeUser({ daysPostpartum: 15, onboarded: false });

        await weekProgression(NOW);

        expect(await flowInstanceModel.countDocuments({ userId: user._id })).toBe(0);
        expect(await weekdaysOf(user._id)).toMatchObject({ weeks: 3 });
    });

    it("sends no notifications — that is a separate job", async () => {
        await publishFlowDefinition();
        await makeUser({ daysPostpartum: 14 });

        await weekProgression(NOW);

        expect(sendPushNotificationMock).not.toHaveBeenCalled();
    });

    it("opens no check-in for an NN user carrying an old delivery date", async () => {
        // Gating purely on the date would have opened check-ins — and pushed
        // notifications — for a woman who told us she is not pregnant.
        await publishFlowDefinition();
        const user = await makeUser({ daysPostpartum: 15, category: EUserCategory.NN });

        await weekProgression(NOW);

        expect(await flowInstanceModel.countDocuments({ userId: user._id })).toBe(0);
    });

    it("stops opening check-ins past the 52-week ceiling", async () => {
        // The start endpoint rejects week > 52, so creating instances beyond it would
        // strand her with an enabled button and a 400.
        await publishFlowDefinition();
        const user = await makeUser({ daysPostpartum: 52 * 7 });

        await weekProgression(NOW);

        expect(await weekdaysOf(user._id)).toMatchObject({ weeks: 53 });
        expect(await flowInstanceModel.countDocuments({ userId: user._id })).toBe(0);
    });

    it("misses a week entirely, then opens the next one", async () => {
        // She never opens week 3's check-in. When week 4 arrives, week 3 is closed for
        // good and week 4 opens — the window is the week, not a rolling 7 days.
        await publishFlowDefinition();
        const user = await makeUser({ daysPostpartum: 14 }); // week 3, day 0

        await weekProgression(NOW);
        await weekProgression(new Date(NOW.getTime() + 7 * 86_400_000));

        const instances = await flowInstanceModel
            .find({ userId: user._id })
            .sort({ postpartumWeek: 1 })
            .lean();

        expect(instances.map((i) => [i.postpartumWeek, i.state])).toEqual([
            [3, FlowInstanceStateEnum.EXPIRED],
            [4, FlowInstanceStateEnum.PENDING],
        ]);
    });

    it("does not reopen a completed check-in later in the same week", async () => {
        await publishFlowDefinition();
        const user = await makeUser({ daysPostpartum: 14 });

        await weekProgression(NOW);
        await flowInstanceModel.updateOne(
            { userId: user._id },
            { $set: { state: FlowInstanceStateEnum.COMPLETED } },
        );

        // Three more days pass inside the same week.
        await weekProgression(new Date(NOW.getTime() + 3 * 86_400_000));

        const instances = await flowInstanceModel.find({ userId: user._id }).lean();
        expect(instances).toHaveLength(1);
        expect(instances[0].state).toBe(FlowInstanceStateEnum.COMPLETED);
    });
});

describe("pregnancyTransition", () => {
    it("flips an NP user to PP once her delivery date arrives", async () => {
        // Nothing did this before: the only NP -> PP move was a profile edit, which is
        // itself blocked for PP users, so a woman who delivered was stranded as NP.
        const user = await makeUser({
            deliveryDate: deliveredDaysAgo(1),
            category: EUserCategory.NP,
        });

        const result = await pregnancyTransition(NOW);

        expect(result.transitioned).toBe(1);
        expect((await UserModel.findById(user._id).lean())!.user_category).toBe(EUserCategory.PP);
    });

    /**
     * REGRESSION: the query compared the stored delivery_date against the UTC-midnight
     * *marker* for today's IST calendar day. Delivery dates carry whatever time-of-day
     * they were captured at, so anything past 00:00 UTC on the due date failed the
     * comparison and the woman was never transitioned.
     */
    it("transitions regardless of the delivery date's time of day", async () => {
        const times = ["00:00", "03:30", "12:00", "18:29"];

        for (const time of times) {
            const user = await makeUser({
                deliveryDate: new Date(`2026-07-29T${time}:00.000Z`),
                category: EUserCategory.NP,
            });

            await pregnancyTransition(NOW);

            const after = await UserModel.findById(user._id).lean();
            expect([time, after!.user_category]).toEqual([time, EUserCategory.PP]);
        }
    });

    it("does not transition a date that is still tomorrow in IST", async () => {
        // 19:00 UTC on the 29th is already 00:30 IST on the 30th.
        const user = await makeUser({
            deliveryDate: new Date("2026-07-29T19:00:00.000Z"),
            category: EUserCategory.NP,
        });

        await pregnancyTransition(NOW);

        expect((await UserModel.findById(user._id).lean())!.user_category).toBe(EUserCategory.NP);
    });

    it("leaves a still-pregnant user alone", async () => {
        const user = await makeUser({
            deliveryDate: new Date(NOW.getTime() + 10 * 86_400_000),
            category: EUserCategory.NP,
        });

        await pregnancyTransition(NOW);

        expect((await UserModel.findById(user._id).lean())!.user_category).toBe(EUserCategory.NP);
    });

    it("hands over to weekProgression, which then treats her as postpartum", async () => {
        await publishFlowDefinition();
        const user = await makeUser({
            deliveryDate: deliveredDaysAgo(0),
            category: EUserCategory.NP,
        });

        await pregnancyTransition(NOW);
        await weekProgression(NOW);

        expect(await weekdaysOf(user._id)).toMatchObject({ weeks: 1, days: 0 });
        expect(await flowInstanceModel.countDocuments({ userId: user._id })).toBe(1);
    });
});

describe("checkinNotification", () => {
    it("nudges on the day the check-in opens", async () => {
        await publishFlowDefinition();
        await makeUser({ daysPostpartum: 14 }); // week 3, day 0
        await weekProgression(NOW);

        const result = await checkinNotification(NOW);

        expect(result.sent).toBe(1);
        const payload = sendPushNotificationMock.mock.calls[0][0] as any;
        expect(payload.data.type).toBe("WEEKLY_CHECKIN");
        // The app's deep-link handler routes on flowSlug; without it the push opens the
        // app but lands nowhere.
        expect(payload.data.flowSlug).toBe(WEEKLY_CHECKIN_SLUG);
        expect(payload.data.daysLeft).toBe("7");
    });

    it("reminds on day 1 but stays quiet on day 2", async () => {
        await publishFlowDefinition();
        await makeUser({ daysPostpartum: 15 }); // week 3, day 1
        await weekProgression(NOW);

        await checkinNotification(NOW);
        expect(sendPushNotificationMock).toHaveBeenCalledTimes(1);
        expect((sendPushNotificationMock.mock.calls[0][0] as any).data.type).toBe(
            "WEEKLY_CHECKIN_REMINDER",
        );

        sendPushNotificationMock.mockClear();

        const dayTwo = new Date(NOW.getTime() + 86_400_000);
        await checkinNotification(dayTwo);
        expect(sendPushNotificationMock).not.toHaveBeenCalled();
    });

    it("says nothing once the check-in is completed", async () => {
        await publishFlowDefinition();
        const user = await makeUser({ daysPostpartum: 14 });
        await weekProgression(NOW);

        await flowInstanceModel.updateOne(
            { userId: user._id },
            { $set: { state: FlowInstanceStateEnum.COMPLETED } },
        );

        const result = await checkinNotification(NOW);

        expect(result.sent).toBe(0);
        expect(sendPushNotificationMock).not.toHaveBeenCalled();
    });

    it("sends nothing to a user without an FCM token", async () => {
        await publishFlowDefinition();
        await makeUser({ daysPostpartum: 14, fcmToken: null });
        await weekProgression(NOW);

        const result = await checkinNotification(NOW);

        expect(result.sent).toBe(0);
    });

    it("goes silent once the user is past the end of the programme", async () => {
        // Open her week-52 check-in, then move the clock past the ceiling. Even with a
        // row still open, there is nothing left to nudge toward.
        await publishFlowDefinition();
        await makeUser({ daysPostpartum: 51 * 7 }); // week 52, day 0
        await weekProgression(NOW);

        const result = await checkinNotification(new Date(NOW.getTime() + 7 * 86_400_000));

        expect(result.sent).toBe(0);
        expect(sendPushNotificationMock).not.toHaveBeenCalled();
    });

    it("localizes to the user's preferred language", async () => {
        await publishFlowDefinition();
        const user = await makeUser({ daysPostpartum: 14 });
        await UserModel.updateOne({ _id: user._id }, { $set: { preferred_language: "hi" } });
        await weekProgression(NOW);

        await checkinNotification(NOW);

        // The old "check-in opened" push read the flow definition's raw templates and was
        // never localized; only the (unscheduled) reminder was.
        const payload = sendPushNotificationMock.mock.calls[0][0] as any;
        expect(payload.title).toBe("साप्ताहिक जाँच उपलब्ध है");
    });
});
