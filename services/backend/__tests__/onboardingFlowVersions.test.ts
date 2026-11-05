/**
 * The old and new onboarding running side by side: the Play Store build asks for
 * onboarding-flow-v2 and newer builds ask for onboarding-flow-v3, on the same routes.
 *
 * What must hold is that nothing done for v3 can reach someone on v2, because that build
 * cannot show the newer questions properly.
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
import { getFlowCompletionMessage } from "../src/constants/chat";
import { ONBOARDING_SLUG, ONBOARDING_SLUG_V3 } from "../src/constants/conversationSlugs";
import conversationModel from "../src/models/conversation.model";
import flowDefinitionModel from "../src/models/flowDefinition.model";
import flowInstanceModel from "../src/models/flowInstance.model";
import messageModel from "../src/models/message.model";
import UserModel from "../src/models/user.model";
import { getOrCreateFlowConversation } from "../src/services/chat-system/flow-conversation.service";
import { restore } from "../src/services/migration/steps/restore-onboarding-v2.step";
import {
    migrate,
    PRD_SECTION1_NODE_IDS,
} from "../src/services/migration/steps/update-onboarding-prd-section1.step";
import WeeklyCheckinService from "../src/services/weekly-checkin-v1/weekly-checkin.service";
import { FlowInstanceStateEnum } from "../src/types/chat.types";

jest.setTimeout(120000);

const service = new WeeklyCheckinService();

const stubNode = (id: string, next: string | null, overrides: Record<string, unknown> = {}) => ({
    id,
    categoryId: null,
    indicator: id,
    nodeType: "QUESTION_SINGLE",
    text: `old ${id}`,
    educationalMessage: "",
    whyThisMatters: "",
    validWeekStart: null,
    validWeekEnd: null,
    options: [{ label: "Yes", value: "yes", score: 1 }],
    branch: null,
    calc: null,
    next,
    ...overrides,
});

const seedV2 = () =>
    flowDefinitionModel.create({
        slug: ONBOARDING_SLUG,
        name: "Postpartum Onboarding",
        version: 1,
        status: "PUBLISHED",
        startNodeId: "intro",
        nodes: [
            stubNode("intro", "name"),
            stubNode("name", "dob", { nodeType: "QUESTION_FREE_TEXT", options: [] }),
            stubNode("dob", "delivery_date"),
            stubNode("delivery_date", "pregnancy_conditions"),
            stubNode("pregnancy_conditions", "delivery_outcome"),
            stubNode("delivery_outcome", "parity"),
            stubNode("parity", null),
        ],
        translations: { hi: { name: "hi", nodes: { name: { whyThisMatters: "keep me" } } } },
    });

const findFlow = (slug: string) => flowDefinitionModel.findOne({ slug }).lean() as Promise<any>;

const nodeIds = (flow: any): string[] => flow.nodes.map((node: any) => node.id);

const chainFrom = (flow: any): string[] => {
    const chain: string[] = [];
    let current: string | null = flow.startNodeId;
    while (current) {
        chain.push(current);
        const here: string = current;
        current = flow.nodes.find((node: any) => node.id === here)?.next ?? null;
    }
    return chain;
};

/** A database the earlier version of the step reached: v2 holds the new questions. */
const pollute = async () => {
    await seedV2();
    await migrate();
    const v3 = await findFlow(ONBOARDING_SLUG_V3);
    await flowDefinitionModel.updateOne(
        { slug: ONBOARDING_SLUG },
        { $set: { nodes: v3.nodes, translations: v3.translations } },
    );
    await flowDefinitionModel.deleteOne({ slug: ONBOARDING_SLUG_V3 });
};

const createUser = () =>
    UserModel.create({
        phone_number: "9000000002",
        is_onboarded: { is_questionnaire_completed: false, is_subscription_completed: false },
    });

describe("onboarding flow versions", () => {
    beforeAll(connectTestDb);
    afterEach(clearTestDb);
    afterAll(closeTestDb);

    describe("creating v3", () => {
        it("leaves v2 exactly as it was, however often it runs", async () => {
            await seedV2();
            const before = await findFlow(ONBOARDING_SLUG);

            await migrate();
            await migrate();

            expect(await findFlow(ONBOARDING_SLUG)).toEqual(before);
        });

        it("gives v3 the new questions, their Hindi, and v2's existing Hindi", async () => {
            await seedV2();

            await migrate();

            const v3 = await findFlow(ONBOARDING_SLUG_V3);
            expect(v3.status).toBe("PUBLISHED");
            expect(nodeIds(v3)).toEqual(expect.arrayContaining([...PRD_SECTION1_NODE_IDS]));
            expect(v3.translations.hi.nodes.abha.text).toBeTruthy();
            expect(v3.translations.hi.nodes.name.whyThisMatters).toBe("keep me");
            expect(v3.nodes.find((node: any) => node.id === "name").text).toBe(
                "What is your Name?",
            );
        });

        it("makes no second copy, and changes nothing on a second run", async () => {
            await seedV2();
            await migrate();
            const first = await findFlow(ONBOARDING_SLUG_V3);

            await expect(migrate()).resolves.toEqual({ insertedNodes: 0, reworded: 0 });

            expect(await flowDefinitionModel.countDocuments({ slug: ONBOARDING_SLUG_V3 })).toBe(1);
            expect((await findFlow(ONBOARDING_SLUG_V3)).nodes).toEqual(first.nodes);
        });

        it("does nothing when there is no v2 to copy", async () => {
            await expect(migrate()).resolves.toEqual({ insertedNodes: 0, reworded: 0 });
            expect(await findFlow(ONBOARDING_SLUG_V3)).toBeNull();
        });
    });

    describe("restoring a v2 that already has the new questions", () => {
        it("only reports, unless told to apply", async () => {
            await pollute();
            const before = await findFlow(ONBOARDING_SLUG);

            const result = await restore();

            expect(result.applied).toBe(false);
            expect(result.foundNodeIds).toHaveLength(PRD_SECTION1_NODE_IDS.length);
            expect(await findFlow(ONBOARDING_SLUG)).toEqual(before);
        });

        it("removes them, relinks the chain and removes their Hindi", async () => {
            await pollute();

            const result = await restore({ apply: true });

            expect(result.applied).toBe(true);
            const v2 = await findFlow(ONBOARDING_SLUG);
            const original = [
                "intro",
                "name",
                "dob",
                "delivery_date",
                "pregnancy_conditions",
                "delivery_outcome",
                "parity",
            ];
            expect(nodeIds(v2)).toEqual(original);
            expect(chainFrom(v2)).toEqual(original);
            expect(v2.translations.hi.nodes.abha).toBeUndefined();
            expect(v2.translations.hi.nodes.name.whyThisMatters).toBe("keep me");
        });

        it("moves someone on a removed question to the next one that stays", async () => {
            await pollute();
            const v2 = await findFlow(ONBOARDING_SLUG);
            const user = await createUser();
            const instance = await flowInstanceModel.create({
                userId: user._id,
                conversationId: user._id,
                flowDefId: v2._id,
                flowSlug: ONBOARDING_SLUG,
                version: 1,
                postpartumWeek: 1,
                state: FlowInstanceStateEnum.ACTIVE,
                cursorNodeId: "abha_method",
                variables: {},
            });

            const result = await restore({ apply: true });

            expect(result.instancesToMove).toBe(1);
            const moved = await flowInstanceModel.findById(instance._id).lean();
            expect(moved!.cursorNodeId).toBe("dob");
        });

        it("finds nothing to do on a clean v2", async () => {
            await seedV2();
            const before = await findFlow(ONBOARDING_SLUG);

            const result = await restore({ apply: true });

            expect(result).toMatchObject({ foundNodeIds: [], applied: false });
            expect(await findFlow(ONBOARDING_SLUG)).toEqual(before);
        });

        it("still gives v3 every question afterwards", async () => {
            await pollute();
            await restore({ apply: true });

            await migrate();

            expect(nodeIds(await findFlow(ONBOARDING_SLUG_V3))).toEqual(
                expect.arrayContaining([...PRD_SECTION1_NODE_IDS]),
            );
            expect(nodeIds(await findFlow(ONBOARDING_SLUG))).not.toContain("abha");
        });
    });

    describe("both flows through the real engine", () => {
        const seedSmallFlow = (slug: string, ids: string[]) =>
            flowDefinitionModel.create({
                slug,
                name: slug,
                version: 1,
                status: "PUBLISHED",
                startNodeId: ids[0],
                nodes: ids.map((id, index) => stubNode(id, ids[index + 1] ?? null)),
            });

        /** Answer every question, returning the ids she was asked and the last message. */
        const runToEnd = async (userId: string, flowSlug: string) => {
            const start = await service.startCheckin({ userId, week: 1, flowSlug } as any);
            expect(start.success).toBe(true);

            const flowInstanceId = start.data!.flowInstanceId;
            const asked: string[] = [];
            let nodeId: string | undefined = start.data!.nextQuestion?.id;
            while (nodeId) {
                asked.push(nodeId);
                const res = await service.processAnswer({
                    userId,
                    flowInstanceId,
                    nodeId,
                    week: 1,
                    idempotencyKey: `${flowInstanceId}-${nodeId}`,
                    selectedValues: ["yes"],
                } as any);
                expect(res.success).toBe(true);
                nodeId = res.data?.nextQuestion?.id;
            }
            return asked;
        };

        const lastMessageText = async (userId: unknown) => {
            const conversation = await conversationModel.findOne({ userId }).lean();
            const message = await messageModel
                .findOne({ conversationId: conversation!._id })
                .sort({ createdAt: -1, _id: -1 })
                .lean();
            return (message as any).text ?? (message as any).content;
        };

        beforeEach(async () => {
            await seedSmallFlow(ONBOARDING_SLUG, ["old_a", "old_b"]);
            await seedSmallFlow(ONBOARDING_SLUG_V3, ["new_a", "new_b", "new_c"]);
        });

        it("asks an old-app user only v2's questions, with v2's closing message", async () => {
            const user = await createUser();

            const asked = await runToEnd(String(user._id), ONBOARDING_SLUG);

            expect(asked).toEqual(["old_a", "old_b"]);
            const saved = await UserModel.findById(user._id).lean();
            expect(saved!.is_onboarded.is_questionnaire_completed).toBe(true);
            expect(await lastMessageText(user._id)).toBe(
                getFlowCompletionMessage("ONBOARDING_LEGACY", "en"),
            );
        });

        it("asks a new-app user only v3's questions, and also completes onboarding", async () => {
            const user = await createUser();

            const asked = await runToEnd(String(user._id), ONBOARDING_SLUG_V3);

            expect(asked).toEqual(["new_a", "new_b", "new_c"]);
            const saved = await UserModel.findById(user._id).lean();
            expect(saved!.is_onboarded.is_questionnaire_completed).toBe(true);
            expect(await lastMessageText(user._id)).toBe(
                getFlowCompletionMessage("ONBOARDING", "en"),
            );
        });

        it("starts v3 from the first question for someone part-way through v2", async () => {
            const user = await createUser();
            const userId = String(user._id);
            const v2Start = await service.startCheckin({
                userId,
                week: 1,
                flowSlug: ONBOARDING_SLUG,
            } as any);
            await service.processAnswer({
                userId,
                flowInstanceId: v2Start.data!.flowInstanceId,
                nodeId: "old_a",
                week: 1,
                idempotencyKey: "first",
                selectedValues: ["yes"],
            } as any);

            const v3Start = await service.startCheckin({
                userId,
                week: 1,
                flowSlug: ONBOARDING_SLUG_V3,
            } as any);

            expect(v3Start.success).toBe(true);
            expect(v3Start.data!.nextQuestion!.id).toBe("new_a");
            expect(String(v3Start.data!.flowInstanceId)).not.toBe(
                String(v2Start.data!.flowInstanceId),
            );
        });
    });

    describe("copy", () => {
        it("keeps both slugs in the one onboarding conversation", async () => {
            const user = await createUser();

            const first = await getOrCreateFlowConversation(user as any, ONBOARDING_SLUG);
            const second = await getOrCreateFlowConversation(user as any, ONBOARDING_SLUG_V3);

            expect(String(second._id)).toBe(String(first._id));
            const conversation = await conversationModel.findById(first._id).lean();
            expect((conversation as any).title).toBe("Onboarding");
        });

        it.each(["en", "hi"] as const)(
            "names no screen that only some app builds have, in %s",
            (lang) => {
                for (const key of ["CHECK_IN", "BABY_ONBOARDING"] as const) {
                    const text = getFlowCompletionMessage(key, lang);
                    expect(text).not.toMatch(/Journey|dashboard|Library/i);
                    expect(text).not.toMatch(/यात्रा|डैशबोर्ड|लाइब्रेरी/);
                }
            },
        );
    });
});
