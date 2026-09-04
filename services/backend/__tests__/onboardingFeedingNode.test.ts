/**
 * The "feeding" onboarding question: how it gets into the published flow, and what
 * answering it does to the user document.
 *
 * The visibility rule itself (postpartum-only) lives in two private id lists inside
 * ChatFlowService.findNextValidNode, reachable only through the websocket/SSE response
 * path, so it is verified by manual walkthrough rather than here.
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
import flowDefinitionModel from "../src/models/flowDefinition.model";
import UserModel from "../src/models/user.model";
import { migrate } from "../src/services/migration/steps/add-onboarding-feeding-node.step";
import ChatFlowService from "../src/services/chat-system/chat-flow.service";
import { FeedingMethodEnum } from "../src/types/user.types";

jest.setTimeout(120000);

const ONBOARDING_SLUG = "onboarding-flow-v2";

/** The three nodes the insertion cares about, in their pre-migration wiring. */
async function seedOnboardingFlow(overrides: Record<string, unknown> = {}) {
    return flowDefinitionModel.create({
        slug: ONBOARDING_SLUG,
        name: "Postpartum Onboarding",
        version: 1,
        status: "PUBLISHED",
        startNodeId: "delivery_type",
        nodes: [
            {
                id: "delivery_type",
                nodeType: "QUESTION_SINGLE",
                text: "How did you give birth?",
                options: [{ label: "Vaginal Birth", value: "vaginal", score: 2 }],
                next: "delivery_outcome",
            },
            {
                id: "delivery_outcome",
                nodeType: "QUESTION_SINGLE",
                text: "What was the outcome of your delivery?",
                options: [{ label: "My baby is here", value: "live_birth", score: 2 }],
                next: "meds_history",
            },
            {
                id: "meds_history",
                nodeType: "QUESTION_MULTI",
                text: "Regular medication?",
                options: [{ label: "None of the above", value: "history_none", score: 2 }],
                next: null,
            },
        ],
        translations: { hi: { nodes: { delivery_outcome: { text: "प्रसव का परिणाम" } } } },
        ...overrides,
    });
}

const nodeIds = (nodes: any[]) => nodes.map((n: any) => n.id);
const byId = (nodes: any[], id: string) => nodes.find((n: any) => n.id === id);

async function reload() {
    const doc = await flowDefinitionModel.findOne({ slug: ONBOARDING_SLUG });
    return (doc!.toObject() as any);
}

beforeAll(async () => {
    await connectTestDb();
});

afterAll(async () => {
    await closeTestDb();
});

afterEach(async () => {
    await clearTestDb();
});

describe("add-onboarding-feeding-node migration", () => {
    it("inserts the node directly after delivery_outcome and rewires the chain", async () => {
        await seedOnboardingFlow();

        await expect(migrate()).resolves.toEqual({ inserted: true });

        const flow = await reload();
        // Position matters: Edit Profile renders questions in stored array order.
        expect(nodeIds(flow.nodes)).toEqual([
            "delivery_type",
            "delivery_outcome",
            "feeding",
            "meds_history",
        ]);
        expect(byId(flow.nodes, "delivery_outcome").next).toBe("feeding");
        expect(byId(flow.nodes, "feeding").next).toBe("meds_history");
    });

    it("carries the three feeding options with no scores", async () => {
        await seedOnboardingFlow();
        await migrate();

        const feeding = byId((await reload()).nodes, "feeding");

        expect(feeding.nodeType).toBe("QUESTION_SINGLE");
        expect(feeding.options.map((o: any) => o.value)).toEqual([
            "only_breastmilk",
            "mixed",
            "not_breastfeeding",
        ]);
        // Onboarding option scores are not read by the score engine; scoring a feeding
        // method would also imply a right answer.
        expect(feeding.options.every((o: any) => o.score === null)).toBe(true);
    });

    it("adopts whatever delivery_outcome pointed at, rather than assuming meds_history", async () => {
        const flow = await seedOnboardingFlow();
        await flowDefinitionModel.updateOne(
            { _id: flow._id, "nodes.id": "delivery_outcome" },
            { $set: { "nodes.$.next": "smoking" } },
        );

        await migrate();

        expect(byId((await reload()).nodes, "feeding").next).toBe("smoking");
    });

    it("writes the Hindi bundle without disturbing the existing one", async () => {
        await seedOnboardingFlow();
        await migrate();

        const flow = await reload();
        expect(flow.translations.hi.nodes.feeding.options).toEqual({
            only_breastmilk: expect.any(String),
            mixed: expect.any(String),
            not_breastfeeding: expect.any(String),
        });
        expect(flow.translations.hi.nodes.delivery_outcome.text).toBe("प्रसव का परिणाम");
    });

    it("is idempotent — a second run inserts nothing and duplicates nothing", async () => {
        await seedOnboardingFlow();
        await migrate();

        await expect(migrate()).resolves.toEqual({ inserted: false });

        const flow = await reload();
        expect(nodeIds(flow.nodes).filter((id: string) => id === "feeding")).toHaveLength(1);
        expect(byId(flow.nodes, "feeding").next).toBe("meds_history");
    });

    /**
     * add-hindi-translations replaces `translations.hi` wholesale and runs before this
     * step on every run-all. Re-running must restore the node's Hindi, or the question
     * silently reverts to English for Hindi users on the second run.
     */
    it("restores the Hindi after another step has wiped translations.hi", async () => {
        const flow = await seedOnboardingFlow();
        await migrate();

        await flowDefinitionModel.updateOne(
            { _id: flow._id },
            { $set: { "translations.hi": { nodes: { delivery_outcome: { text: "x" } } } } },
        );

        await migrate();

        expect((await reload()).translations.hi.nodes.feeding).toBeDefined();
    });

    it("does nothing when the flow has no delivery_outcome to anchor to", async () => {
        await flowDefinitionModel.create({
            slug: ONBOARDING_SLUG,
            name: "Postpartum Onboarding",
            version: 1,
            status: "PUBLISHED",
            startNodeId: "name",
            nodes: [{ id: "name", nodeType: "QUESTION_FREE_TEXT", text: "Name?", next: null }],
        });

        await expect(migrate()).resolves.toEqual({ inserted: false });
        expect(nodeIds((await reload()).nodes)).toEqual(["name"]);
    });

    it("does nothing when there is no published onboarding flow", async () => {
        await expect(migrate()).resolves.toEqual({ inserted: false });
    });
});

describe("answering the feeding question", () => {
    const service = new ChatFlowService();

    async function answerFeeding(value: string) {
        const user = await UserModel.create({
            mobile_number: `9${Math.floor(Math.random() * 1_000_000_000)}`,
        });
        const flow = await seedOnboardingFlow();
        await migrate();

        await service.updateOnboardingData(
            String(user._id),
            await flowDefinitionModel.findById(flow._id),
            "feeding",
            undefined,
            undefined,
            [value],
        );

        return UserModel.findById(user._id);
    }

    it("stores the answer and marks her as breastfeeding on exclusive breastmilk", async () => {
        const user = await answerFeeding(FeedingMethodEnum.ONLY_BREASTMILK);

        expect(user!.onboarding_data.feeding_method).toBe(FeedingMethodEnum.ONLY_BREASTMILK);
        expect(user!.is_breastfeeding_currently).toBe(true);
    });

    // Mixed feeding still needs the lactation questions, so it must not read as "stopped".
    it("counts mixed feeding as breastfeeding", async () => {
        const user = await answerFeeding(FeedingMethodEnum.MIXED);

        expect(user!.onboarding_data.feeding_method).toBe(FeedingMethodEnum.MIXED);
        expect(user!.is_breastfeeding_currently).toBe(true);
    });

    it("clears the breastfeeding flag when she is not breastfeeding", async () => {
        const user = await answerFeeding(FeedingMethodEnum.NOT_BREASTFEEDING);

        expect(user!.onboarding_data.feeding_method).toBe(FeedingMethodEnum.NOT_BREASTFEEDING);
        expect(user!.is_breastfeeding_currently).toBe(false);
    });
});
