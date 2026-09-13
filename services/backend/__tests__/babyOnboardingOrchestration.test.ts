/**
 * Baby onboarding driven through the real orchestrator, start to finish.
 *
 * The unit tests next door cover the seed, the projection and the subject resolver in
 * isolation. This one is the integration: WeeklyCheckinService.startCheckin ->
 * processAnswer x7 -> completeCheckin, against a real database, asserting what actually
 * ends up on the user document.
 *
 * It is the test that would have caught the two ways this feature can go quietly wrong:
 * the child's answers landing in the mother's onboarding_data, and completion flipping
 * her is_questionnaire_completed.
 */

jest.mock(require.resolve("../src/config/firebase"), () => ({ __esModule: true, default: null }));
jest.mock(require.resolve("../src/config/redis.config"), () => ({ __esModule: true }));
jest.mock("razorpay", () =>
    jest.fn().mockImplementation(() => ({ orders: { create: jest.fn() } })),
);
jest.mock(require.resolve("../src/utils/sendPushNotification"), () => ({
    __esModule: true,
    sendPushNotification: jest.fn(async () => undefined),
}));

import { clearTestDb, closeTestDb, connectTestDb } from "./helpers/db";
import UserModel from "../src/models/user.model";
import flowInstanceModel from "../src/models/flowInstance.model";
import WeeklyCheckinService from "../src/services/weekly-checkin-v1/weekly-checkin.service";
import { migrate as seedBabyFlow } from "../src/services/migration/steps/seed-baby-onboarding-flow.step";
import { BABY_ONBOARDING_SLUG } from "../src/constants/chat";
import { EChildOnboardingStatus, ESex, EVaccinationSector } from "../src/types/user.types";
import { FlowInstanceStateEnum } from "../src/types/chat.types";

jest.setTimeout(120000);

const service = new WeeklyCheckinService();

/** The seven answers, in flow order. */
const ANSWERS: Array<[string, Record<string, unknown>]> = [
    ["child_name", { freeText: "Aarav" }],
    ["child_dob", { freeText: "2026-08-28" }],
    ["child_sex", { selectedValues: [ESex.MALE] }],
    ["child_vaccination_sector", { selectedValues: [EVaccinationSector.PUBLIC] }],
    ["child_birth_head_circumference", { freeText: "34.8" }],
    ["child_birth_length", { freeText: "50.5" }],
    ["child_birth_weight", { freeText: "3250" }],
];

async function createMother() {
    return UserModel.create({
        phone_number: "9000000001",
        is_onboarded: { is_questionnaire_completed: false, is_subscription_completed: false },
    });
}

/** Run the whole flow, returning the childId and every question that was shown. */
async function runFullFlow(userId: string, childId?: string) {
    const start = await service.startCheckin({
        userId,
        week: 1,
        flowSlug: BABY_ONBOARDING_SLUG,
        ...(childId ? { childId } : {}),
    });

    expect(start.success).toBe(true);

    const flowInstanceId = start.data!.flowInstanceId;
    const questions: string[] = [start.data!.nextQuestion!.text];

    for (const [nodeId, payload] of ANSWERS) {
        const res = await service.processAnswer({
            userId,
            flowInstanceId,
            nodeId,
            week: 1,
            idempotencyKey: `${flowInstanceId}-${nodeId}`,
            ...payload,
        } as any);

        expect(res.success).toBe(true);
        if (res.data?.nextQuestion) questions.push(res.data.nextQuestion.text);
    }

    return { start, flowInstanceId, resolvedChildId: start.data!.childId!, questions };
}

beforeAll(async () => {
    await connectTestDb();
});

afterAll(async () => {
    await closeTestDb();
});

beforeEach(async () => {
    await clearTestDb();
    await seedBabyFlow();
});

describe("baby onboarding, end to end", () => {
    it("starts by creating a draft child and asking for the name", async () => {
        const user = await createMother();
        const res = await service.startCheckin({
            userId: user._id.toString(),
            week: 1,
            flowSlug: BABY_ONBOARDING_SLUG,
        });

        expect(res.success).toBe(true);
        expect(res.data!.childId).toBeDefined();
        expect(res.data!.nextQuestion!.id).toBe("child_name");

        const fresh = await UserModel.findById(user._id).lean();
        expect(fresh!.childs).toHaveLength(1);
        expect(fresh!.childs[0]!.onboarding_status).toBe(EChildOnboardingStatus.DRAFT);
    });

    it("walks all seven questions and writes a complete child", async () => {
        const user = await createMother();
        const userId = user._id.toString();

        const { resolvedChildId } = await runFullFlow(userId);

        const fresh = await UserModel.findById(userId).lean();
        const child = fresh!.childs.find((c) => c._id!.toString() === resolvedChildId)!;

        expect(child).toMatchObject({
            name: "Aarav",
            sex: ESex.MALE,
            vaccination_sector: EVaccinationSector.PUBLIC,
            onboarding_status: EChildOnboardingStatus.COMPLETED,
        });
        expect(child.birth_measurements).toMatchObject({
            head_circumference_cm: 34.8,
            length_cm: 50.5,
            weight_grams: 3250,
        });
        expect(child.date_of_birth).toEqual(new Date("2026-08-28"));
        expect(child.onboarded_at).toBeInstanceOf(Date);
    });

    it("leaves the mother's own onboarding completely untouched", async () => {
        // The regression this whole branch hinges on: completeCheckin used to treat any
        // non-check-in slug as the mother's onboarding.
        const user = await createMother();
        const userId = user._id.toString();

        await runFullFlow(userId);

        const fresh = await UserModel.findById(userId).lean();
        expect(fresh!.is_onboarded?.is_questionnaire_completed).toBe(false);

        // Nullish rather than undefined: these carry schema defaults of null, so "still at
        // its default" is the real claim. The specific danger is the child's answers
        // bleeding into the mother's projection, so assert that by name too.
        expect(fresh!.onboarding_data?.preferred_name ?? null).toBeNull();
        expect(fresh!.onboarding_data?.date_of_birth ?? null).toBeNull();
        expect(fresh!.onboarding_data?.onboarded_at ?? null).toBeNull();
        expect(fresh!.onboarding_data?.preferred_name).not.toBe("Aarav");
    });

    it("addresses the child by name once it knows it", async () => {
        const user = await createMother();
        const { questions } = await runFullFlow(user._id.toString());

        // The name question itself cannot be interpolated; everything after it can.
        expect(questions[0]).not.toContain("Aarav");
        expect(questions[1]).toBe("When was Aarav born?");
        expect(questions.slice(1).every((q) => q.includes("Aarav"))).toBe(true);
        expect(questions.join(" ")).not.toContain("{{");
    });

    it("marks the flow instance completed and parks the cursor", async () => {
        const user = await createMother();
        const { flowInstanceId } = await runFullFlow(user._id.toString());

        const instance = await flowInstanceModel.findById(flowInstanceId).lean();
        expect(instance!.state).toBe(FlowInstanceStateEnum.COMPLETED);
        expect(instance!.cursorNodeId).toBeNull();
    });

    it("resumes an interrupted run at the right question instead of restarting", async () => {
        const user = await createMother();
        const userId = user._id.toString();

        const start = await service.startCheckin({
            userId,
            week: 1,
            flowSlug: BABY_ONBOARDING_SLUG,
        });
        await service.processAnswer({
            userId,
            flowInstanceId: start.data!.flowInstanceId,
            nodeId: "child_name",
            week: 1,
            freeText: "Aarav",
            idempotencyKey: "k1",
        } as any);

        // Second start with no childId — the app killed and reopened.
        const resumed = await service.startCheckin({
            userId,
            week: 1,
            flowSlug: BABY_ONBOARDING_SLUG,
        });

        expect(resumed.data!.childId).toBe(start.data!.childId);
        expect(resumed.data!.nextQuestion!.id).toBe("child_dob");

        const fresh = await UserModel.findById(userId).lean();
        expect(fresh!.childs).toHaveLength(1);
    });

    it("supports a second child once the run for the first has finished", async () => {
        const user = await createMother();
        const userId = user._id.toString();

        const first = await runFullFlow(userId);
        const second = await runFullFlow(userId);

        expect(second.resolvedChildId).not.toBe(first.resolvedChildId);

        const fresh = await UserModel.findById(userId).lean();
        expect(fresh!.childs).toHaveLength(2);
        expect(
            fresh!.childs.every(
                (c) => c.onboarding_status === EChildOnboardingStatus.COMPLETED,
            ),
        ).toBe(true);
        expect(fresh!.is_onboarded?.is_questionnaire_completed).toBe(false);
    });

    it("is idempotent on a retried answer", async () => {
        const user = await createMother();
        const userId = user._id.toString();

        const start = await service.startCheckin({
            userId,
            week: 1,
            flowSlug: BABY_ONBOARDING_SLUG,
        });

        const payload = {
            userId,
            flowInstanceId: start.data!.flowInstanceId,
            nodeId: "child_name",
            week: 1,
            freeText: "Aarav",
            idempotencyKey: "same-key",
        };

        const first = await service.processAnswer(payload as any);
        const retry = await service.processAnswer(payload as any);

        expect(first.success).toBe(true);
        expect(retry.success).toBe(true);
        // A retry must not advance the flow past the question it answered.
        expect(retry.data!.nextQuestion!.id).toBe("child_dob");
    });

    it("refuses a childId that belongs to another user", async () => {
        const user = await createMother();
        const stranger = await UserModel.create({ phone_number: "9000000002" });
        const strangerRun = await service.startCheckin({
            userId: stranger._id.toString(),
            week: 1,
            flowSlug: BABY_ONBOARDING_SLUG,
        });

        const res = await service.startCheckin({
            userId: user._id.toString(),
            week: 1,
            flowSlug: BABY_ONBOARDING_SLUG,
            childId: strangerRun.data!.childId!,
        });

        expect(res.success).toBe(false);
    });
});
