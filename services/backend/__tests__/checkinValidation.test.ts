jest.mock(require.resolve("../src/config/firebase"), () => ({ __esModule: true, default: null }));
jest.mock(require.resolve("../src/config/redis.config"), () => ({ __esModule: true }));

import { connectTestDb, closeTestDb, clearTestDb } from "./helpers/db";
import UserModel from "../src/models/user.model";
import flowDefinitionModel from "../src/models/flowDefinition.model";
import flowInstanceModel from "../src/models/flowInstance.model";
import conversationModel from "../src/models/conversation.model";
import { validationService } from "../src/services/weekly-checkin-v1/validation.service";
import { WEEKLY_CHECKIN_SLUG } from "../src/constants/chat";
import { FlowInstanceStateEnum } from "../src/types/chat.types";
import { EUserCategory } from "../src/types/user.types";
import { IUser } from "../src/types";

jest.setTimeout(120000);

const ONBOARDING_SLUG = "onboarding-flow-v2";

const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000);
const daysAhead = (days: number) => new Date(Date.now() + days * 86_400_000);

async function makeUser(overrides: Record<string, unknown> = {}) {
    return (await UserModel.create({
        mobile_number: `9${Math.floor(Math.random() * 1_000_000_000)}`,
        user_category: EUserCategory.PP,
        is_onboarded: { is_questionnaire_completed: true },
        onboarding_data: { delivery_date: daysAgo(15) }, // week 3, day 1
        ...overrides,
    })) as unknown as IUser;
}

async function publish(slug: string) {
    return flowDefinitionModel.create({
        slug,
        version: 1,
        status: "PUBLISHED",
        startNodeId: "q1",
        nodes: [{ id: "q1", nodeType: "SINGLE_CHOICE", text: "?", options: [] }],
    });
}

beforeAll(connectTestDb);
afterAll(closeTestDb);
beforeEach(clearTestDb);

describe("validateSSERequest — weekly check-in", () => {
    it("accepts the current week", async () => {
        await publish(WEEKLY_CHECKIN_SLUG);
        const user = await makeUser();

        const result = await validationService.validateSSERequest(user, 3, WEEKLY_CHECKIN_SLUG);

        expect(result.isValid).toBe(true);
        expect(result.flowInstance!.postpartumWeek).toBe(3);
    });

    it("rejects a future week", async () => {
        await publish(WEEKLY_CHECKIN_SLUG);
        const user = await makeUser();

        const result = await validationService.validateSSERequest(user, 4, WEEKLY_CHECKIN_SLUG);

        expect(result.isValid).toBe(false);
    });

    it("rejects a past week — the window is the week, not four of them", async () => {
        await publish(WEEKLY_CHECKIN_SLUG);
        const user = await makeUser();

        const result = await validationService.validateSSERequest(user, 2, WEEKLY_CHECKIN_SLUG);

        expect(result.isValid).toBe(false);
        // And nothing is created for the past week.
        expect(await flowInstanceModel.countDocuments({ postpartumWeek: 2 })).toBe(0);
    });

    it("derives the week from the delivery date, not the cron-written copy", async () => {
        // The stored week is deliberately stale, as it would be if the nightly job had
        // failed. The request path must still accept her real current week.
        await publish(WEEKLY_CHECKIN_SLUG);
        const user = await makeUser({ current_weekdays: { weeks: 1, days: 0 } });

        const result = await validationService.validateSSERequest(user, 3, WEEKLY_CHECKIN_SLUG);

        expect(result.isValid).toBe(true);
    });

    it("creates the instance on demand when the week job has not run", async () => {
        await publish(WEEKLY_CHECKIN_SLUG);
        const user = await makeUser();

        expect(await flowInstanceModel.countDocuments({})).toBe(0);

        const result = await validationService.validateSSERequest(user, 3, WEEKLY_CHECKIN_SLUG);

        expect(result.isValid).toBe(true);
        expect(result.flowInstance!.state).toBe(FlowInstanceStateEnum.ACTIVE);
    });

    it("flips a pre-created PENDING instance to ACTIVE", async () => {
        // This transition is what the entitlement gate reads to tell a new start from a
        // resume, so it has to happen exactly once.
        const def = await publish(WEEKLY_CHECKIN_SLUG);
        const user = await makeUser();
        await flowInstanceModel.create({
            userId: user._id,
            flowDefId: def._id,
            flowSlug: WEEKLY_CHECKIN_SLUG,
            version: 1,
            postpartumWeek: 3,
            state: FlowInstanceStateEnum.PENDING,
            cursorNodeId: "q1",
        });

        const result = await validationService.validateSSERequest(user, 3, WEEKLY_CHECKIN_SLUG);

        expect(result.isValid).toBe(true);
        expect(result.flowInstance!.state).toBe(FlowInstanceStateEnum.ACTIVE);
    });

    it("refuses a completed check-in", async () => {
        const def = await publish(WEEKLY_CHECKIN_SLUG);
        const user = await makeUser();
        await flowInstanceModel.create({
            userId: user._id,
            flowDefId: def._id,
            flowSlug: WEEKLY_CHECKIN_SLUG,
            version: 1,
            postpartumWeek: 3,
            state: FlowInstanceStateEnum.COMPLETED,
            cursorNodeId: null,
        });

        const result = await validationService.validateSSERequest(user, 3, WEEKLY_CHECKIN_SLUG);

        expect(result.isValid).toBe(false);
        expect(result.error!.type).toBe("ALREADY_COMPLETED");
    });
});

describe("validateSSERequest — onboarding shares this path", () => {
    /**
     * REGRESSION: onboarding runs through the same method. Deriving the "current week"
     * from the delivery date yields 0 for a pregnant user, so gating her gestational week
     * (34) against it rejected her with "weekly check-in has not been triggered yet" —
     * locking a pregnant woman out of onboarding the moment she entered a due date.
     */
    it("lets a pregnant user onboard with her gestational week", async () => {
        await publish(ONBOARDING_SLUG);
        const user = await makeUser({
            user_category: EUserCategory.NP,
            is_onboarded: { is_questionnaire_completed: false },
            onboarding_data: { delivery_date: daysAhead(40) }, // ~34 weeks gestation
            current_weekdays: { weeks: 34, days: 2 },
        });

        const result = await validationService.validateSSERequest(user, 34, ONBOARDING_SLUG);

        expect(result.isValid).toBe(true);
    });

    it("lets a user with no delivery date yet onboard", async () => {
        await publish(ONBOARDING_SLUG);
        const user = await makeUser({
            user_category: null,
            is_onboarded: { is_questionnaire_completed: false },
            onboarding_data: {},
            current_weekdays: { weeks: 1, days: 0 },
        });

        const result = await validationService.validateSSERequest(user, 1, ONBOARDING_SLUG);

        expect(result.isValid).toBe(true);
    });

    /**
     * REGRESSION: createFlowInstance looked its conversation up by the hardcoded tag
     * "check-in" whatever flow it was starting. Onboarding therefore created a
     * conversation titled "Weekly Check-in" and tagged "check-in", and the user's first
     * real check-in then found that same row and reused it — both flows' messages landing
     * in one thread.
     */
    it("gives onboarding and the check-in separate conversations", async () => {
        await publish(ONBOARDING_SLUG);
        await publish(WEEKLY_CHECKIN_SLUG);
        const user = await makeUser({ is_onboarded: { is_questionnaire_completed: false } });

        const onboarding = await validationService.validateSSERequest(user, 3, ONBOARDING_SLUG);
        const checkin = await validationService.validateSSERequest(user, 3, WEEKLY_CHECKIN_SLUG);

        expect(onboarding.isValid).toBe(true);
        expect(checkin.isValid).toBe(true);

        const onboardingConvo = onboarding.flowInstance!.conversationId.toString();
        const checkinConvo = checkin.flowInstance!.conversationId.toString();
        expect(onboardingConvo).not.toBe(checkinConvo);

        const conversations = await conversationModel.find({ userId: user._id }).lean();
        expect(conversations).toHaveLength(2);
        expect(conversations.map((c) => c.meta?.tags?.[0]).sort()).toEqual([
            "check-in",
            "onboarding",
        ]);
    });

    it("keeps every week of check-ins in one conversation", async () => {
        // Deliberate: the check-in should read as a single continuing thread, so weeks
        // share a conversation even though each week has its own flow instance.
        await publish(WEEKLY_CHECKIN_SLUG);
        const user = await makeUser({ onboarding_data: { delivery_date: daysAgo(15) } });

        const weekThree = await validationService.validateSSERequest(user, 3, WEEKLY_CHECKIN_SLUG);

        const laterUser = await UserModel.findById(user._id);
        laterUser!.onboarding_data.delivery_date = daysAgo(22); // now week 4
        const weekFour = await validationService.validateSSERequest(
            laterUser as unknown as IUser,
            4,
            WEEKLY_CHECKIN_SLUG,
        );

        expect(weekThree.flowInstance!.conversationId.toString()).toBe(
            weekFour.flowInstance!.conversationId.toString(),
        );
        expect(await conversationModel.countDocuments({ userId: user._id })).toBe(1);
    });

    it("never expires an onboarding instance on the check-in's 7-day rule", async () => {
        const def = await publish(ONBOARDING_SLUG);
        const user = await makeUser({
            is_onboarded: { is_questionnaire_completed: false },
        });
        const instance = await flowInstanceModel.create({
            userId: user._id,
            flowDefId: def._id,
            flowSlug: ONBOARDING_SLUG,
            version: 1,
            postpartumWeek: 3,
            state: FlowInstanceStateEnum.ACTIVE,
            cursorNodeId: "q1",
        });
        // Backdate well past the check-in expiry window.
        await flowInstanceModel.updateOne(
            { _id: instance._id },
            { $set: { createdAt: daysAgo(60) } },
            { timestamps: false },
        );

        const result = await validationService.validateSSERequest(user, 3, ONBOARDING_SLUG);

        expect(result.isValid).toBe(true);
    });
});
