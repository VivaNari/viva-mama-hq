/**
 * Baby onboarding: the seeded flow definition, the projection onto users.childs[], and the
 * boundary that keeps a child's onboarding from being mistaken for the mother's.
 *
 * That last one is the reason this file exists. completeCheckin used to treat every
 * non-check-in slug as "the mother's onboarding" and set is_questionnaire_completed, so a
 * mother finishing her baby's questions would have been pushed past her own onboarding.
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

import { Types } from "mongoose";

import { clearTestDb, closeTestDb, connectTestDb } from "./helpers/db";
import flowDefinitionModel from "../src/models/flowDefinition.model";
import flowInstanceModel from "../src/models/flowInstance.model";
import UserModel from "../src/models/user.model";
import { migrate as seedBabyFlow } from "../src/services/migration/steps/seed-baby-onboarding-flow.step";
import { migrate as reindexInstances } from "../src/services/migration/steps/reindex-flow-instances-subject.step";
import {
    updateChildOnboardingData,
    markChildOnboardingComplete,
} from "../src/services/chat-system/child-onboarding.projection";
import { resolveSubjectChild } from "../src/services/childs/child-subject.service";
import { interpolateFlowText } from "../src/utils/functions/interpolateFlowText";
import { BABY_ONBOARDING_SLUG } from "../src/constants/chat";
import { EChildOnboardingStatus, ESex, EVaccinationSector } from "../src/types/user.types";
import { FlowInstanceStateEnum } from "../src/types/chat.types";

jest.setTimeout(120000);

async function createUser() {
    return UserModel.create({
        phone_number: "9990001111",
        childs: [],
    });
}

/** Pull one node out of the seeded definition by id. */
async function getNode(nodeId: string) {
    const flow = await flowDefinitionModel.findOne({ slug: BABY_ONBOARDING_SLUG }).lean();
    return (flow!.nodes as any[]).find((node) => node.id === nodeId);
}

beforeAll(async () => {
    await connectTestDb();
});

afterAll(async () => {
    await closeTestDb();
});

beforeEach(async () => {
    await clearTestDb();
});

describe("seed-baby-onboarding-flow", () => {
    it("publishes a linear seven-node flow ending in a null next", async () => {
        const result = await seedBabyFlow();

        expect(result.created).toBe(true);
        expect(result.nodes).toBe(7);

        const flow = await flowDefinitionModel.findOne({ slug: BABY_ONBOARDING_SLUG }).lean();
        expect(flow!.status).toBe("PUBLISHED");
        expect(flow!.startNodeId).toBe("child_name");

        // Walk the chain rather than trusting array order: the engine navigates by
        // `next`, so a break there is invisible to a length assertion.
        const nodes = flow!.nodes as any[];
        const visited: string[] = [];
        let cursor: string | null = flow!.startNodeId;

        while (cursor) {
            expect(visited).not.toContain(cursor); // no cycles
            visited.push(cursor);
            const node: any = nodes.find((n) => n.id === cursor);
            expect(node).toBeDefined();
            cursor = node.next ?? null;
        }

        expect(visited).toEqual([
            "child_name",
            "child_dob",
            "child_sex",
            "child_vaccination_sector",
            "child_birth_head_circumference",
            "child_birth_length",
            "child_birth_weight",
        ]);
    });

    it("offers exactly Female and Male for sex, with no Other", async () => {
        await seedBabyFlow();
        const sexNode = await getNode("child_sex");

        expect(sexNode.options).toHaveLength(2);
        expect(sexNode.options.map((o: any) => o.value).sort()).toEqual(["Female", "Male"]);
        expect(JSON.stringify(sexNode.options)).not.toContain("Other");
    });

    it("uses option values that match the ESex enum casing", async () => {
        // The projector writes the option value straight into childs.$.sex, so a
        // lowercase token here would fail schema validation at answer time.
        await seedBabyFlow();
        const sexNode = await getNode("child_sex");

        const values = sexNode.options.map((o: any) => o.value);
        expect(values).toContain(ESex.FEMALE);
        expect(values).toContain(ESex.MALE);
    });

    it("carries a Hindi bundle for every node", async () => {
        await seedBabyFlow();
        const flow = await flowDefinitionModel.findOne({ slug: BABY_ONBOARDING_SLUG }).lean();

        const hiNodes = (flow!.translations as any).hi.nodes;
        for (const node of flow!.nodes as any[]) {
            expect(hiNodes[node.id]).toBeDefined();
            expect(hiNodes[node.id].text).toBeTruthy();
        }
    });

    it("keeps the {{child_name}} token in the Hindi copy too", async () => {
        // Localization runs first and interpolation second, so the token has to survive
        // translation. A Hindi bundle written without it would address the child by name
        // in English and not at all in Hindi.
        await seedBabyFlow();
        const flow = await flowDefinitionModel.findOne({ slug: BABY_ONBOARDING_SLUG }).lean();
        const hiNodes = (flow!.translations as any).hi.nodes;

        expect(hiNodes.child_dob.text).toContain("{{child_name}}");
        expect(interpolateFlowText(hiNodes.child_dob.text, { child_name: "आशा" })).not.toContain(
            "{{",
        );
    });

    it("translates the sex and sector options under their stored values", async () => {
        // localizeFlowDefinition looks options up by String(opt.value), so the Hindi keys
        // must be the raw tokens ("Female", "public") — not the English labels.
        await seedBabyFlow();
        const flow = await flowDefinitionModel.findOne({ slug: BABY_ONBOARDING_SLUG }).lean();
        const hiNodes = (flow!.translations as any).hi.nodes;

        for (const node of flow!.nodes as any[]) {
            const hiOptions = hiNodes[node.id]?.options;
            if (!hiOptions) continue;
            for (const opt of node.options) {
                expect(hiOptions[String(opt.value)]).toBeTruthy();
            }
        }
    });

    it("is idempotent — a second run creates nothing and duplicates nothing", async () => {
        await seedBabyFlow();
        const second = await seedBabyFlow();

        expect(second.created).toBe(false);

        const count = await flowDefinitionModel.countDocuments({ slug: BABY_ONBOARDING_SLUG });
        expect(count).toBe(1);

        const flow = await flowDefinitionModel.findOne({ slug: BABY_ONBOARDING_SLUG }).lean();
        expect(flow!.nodes).toHaveLength(7);
        expect(flow!.version).toBe(1); // never version-bumped: instances pin the version
    });
});

describe("reindex-flow-instances-subject", () => {
    it("drops the three-field unique index and installs the four-field one", async () => {
        // syncIndexes() in the test helper already builds the schema's current index, so
        // plant the superseded one explicitly to prove the drop actually happens.
        const collection = flowInstanceModel.collection;
        await collection.createIndex(
            { userId: 1, flowSlug: 1, postpartumWeek: 1 },
            { unique: true, name: "userId_1_flowSlug_1_postpartumWeek_1" },
        );

        const result = await reindexInstances();
        expect(result.droppedOldIndex).toBe(true);

        const names = (await collection.indexes()).map((i) => i.name);
        expect(names).not.toContain("userId_1_flowSlug_1_postpartumWeek_1");
        expect(names).toContain("userId_1_flowSlug_1_postpartumWeek_1_subjectChildId_1");
    });

    it("is idempotent", async () => {
        await reindexInstances();
        const second = await reindexInstances();

        expect(second.droppedOldIndex).toBe(false);
        expect(second.createdNewIndex).toBe(false);
    });

    it("lets one user hold a baby-onboarding instance per child", async () => {
        await reindexInstances();
        const user = await createUser();

        const base = {
            userId: user._id,
            conversationId: new Types.ObjectId(),
            flowDefId: new Types.ObjectId(),
            flowSlug: BABY_ONBOARDING_SLUG,
            version: 1,
            postpartumWeek: 1,
            state: FlowInstanceStateEnum.ACTIVE,
        };

        await flowInstanceModel.create({ ...base, subjectChildId: new Types.ObjectId() });

        // The whole point of widening the index: this is the second "Add your baby".
        await expect(
            flowInstanceModel.create({ ...base, subjectChildId: new Types.ObjectId() }),
        ).resolves.toBeDefined();
    });
});

describe("resolveSubjectChild", () => {
    it("creates a DRAFT child when there is nothing to resume", async () => {
        const user = await createUser();
        const { childId, created } = await resolveSubjectChild(user);

        expect(created).toBe(true);

        const fresh = await UserModel.findById(user._id).lean();
        expect(fresh!.childs).toHaveLength(1);
        expect(fresh!.childs[0]!._id!.toString()).toBe(childId.toString());
        expect(fresh!.childs[0]!.onboarding_status).toBe(EChildOnboardingStatus.DRAFT);
    });

    it("resumes an in-flight run instead of stacking up drafts", async () => {
        const user = await createUser();
        const first = await resolveSubjectChild(user);

        await flowInstanceModel.create({
            userId: user._id,
            conversationId: new Types.ObjectId(),
            flowDefId: new Types.ObjectId(),
            flowSlug: BABY_ONBOARDING_SLUG,
            version: 1,
            postpartumWeek: 1,
            subjectChildId: first.childId,
            state: FlowInstanceStateEnum.ACTIVE,
        });

        const reloaded = await UserModel.findById(user._id);
        const second = await resolveSubjectChild(reloaded!);

        expect(second.created).toBe(false);
        expect(second.childId.toString()).toBe(first.childId.toString());

        const fresh = await UserModel.findById(user._id).lean();
        expect(fresh!.childs).toHaveLength(1);
    });

    it("refuses a childId belonging to someone else", async () => {
        const user = await createUser();
        await expect(
            resolveSubjectChild(user, new Types.ObjectId().toString()),
        ).rejects.toThrow(/not found/i);
    });
});

describe("child onboarding projection", () => {
    async function setup() {
        await seedBabyFlow();
        const user = await createUser();
        const { childId } = await resolveSubjectChild(user);
        return { user, childId };
    }

    async function child(userId: any, childId: any) {
        const fresh = await UserModel.findById(userId).lean();
        return fresh!.childs.find((c) => c._id!.toString() === childId.toString())!;
    }

    it("writes each answer onto the right child subdocument", async () => {
        const { user, childId } = await setup();

        await updateChildOnboardingData(
            user._id.toString(),
            childId,
            await getNode("child_name"),
            undefined,
            "Aarav",
        );
        await updateChildOnboardingData(
            user._id.toString(),
            childId,
            await getNode("child_dob"),
            undefined,
            "2026-08-28",
        );
        await updateChildOnboardingData(
            user._id.toString(),
            childId,
            await getNode("child_sex"),
            undefined,
            undefined,
            [ESex.MALE],
        );
        await updateChildOnboardingData(
            user._id.toString(),
            childId,
            await getNode("child_vaccination_sector"),
            undefined,
            undefined,
            [EVaccinationSector.PUBLIC],
        );
        await updateChildOnboardingData(
            user._id.toString(),
            childId,
            await getNode("child_birth_head_circumference"),
            undefined,
            "34.8",
        );
        await updateChildOnboardingData(
            user._id.toString(),
            childId,
            await getNode("child_birth_length"),
            undefined,
            "50.5",
        );
        await updateChildOnboardingData(
            user._id.toString(),
            childId,
            await getNode("child_birth_weight"),
            undefined,
            "3250",
        );

        const saved = await child(user._id, childId);
        expect(saved.name).toBe("Aarav");
        expect(saved.date_of_birth).toEqual(new Date("2026-08-28"));
        expect(saved.sex).toBe(ESex.MALE);
        expect(saved.vaccination_sector).toBe(EVaccinationSector.PUBLIC);
        expect(saved.birth_measurements).toMatchObject({
            head_circumference_cm: 34.8,
            length_cm: 50.5,
            weight_grams: 3250,
        });
    });

    it("discards an out-of-range measurement rather than poisoning the chart", async () => {
        const { user, childId } = await setup();

        await updateChildOnboardingData(
            user._id.toString(),
            childId,
            await getNode("child_birth_weight"),
            undefined,
            "99999",
        );

        const saved = await child(user._id, childId);
        expect(saved.birth_measurements?.weight_grams).toBeUndefined();
    });

    /**
     * The date of birth is the one field a child can never have corrected — it is set at
     * onboarding and is immutable after, so a bad value means deleting the child and every
     * log attached to them. The picker bounds it, but the picker is not the guard.
     */
    describe("the date of birth range", () => {
        const answerDob = async (user: any, childId: any, value: string) =>
            updateChildOnboardingData(
                user._id.toString(),
                childId,
                await getNode("child_dob"),
                undefined,
                value,
            );

        const iso = (offsetDays: number) =>
            new Date(Date.now() + offsetDays * 24 * 60 * 60 * 1000)
                .toISOString()
                .slice(0, 10);

        it("discards a date in the future rather than storing it", async () => {
            const { user, childId } = await setup();

            await answerDob(user, childId, iso(30));

            // Left unset, so the flow asks again. A future date would have put all five
            // log screens into their "before birth" empty state with no way back.
            expect((await child(user._id, childId)).date_of_birth).toBeUndefined();
        });

        it("discards a date older than the product supports", async () => {
            const { user, childId } = await setup();

            await answerDob(user, childId, iso(-365 * 6));

            expect((await child(user._id, childId)).date_of_birth).toBeUndefined();
        });

        it("accepts a child born today", async () => {
            const { user, childId } = await setup();

            await answerDob(user, childId, iso(0));

            expect((await child(user._id, childId)).date_of_birth).toBeDefined();
        });

        it("accepts a date just inside the upper bound", async () => {
            const { user, childId } = await setup();

            await answerDob(user, childId, iso(-365 * 5 + 2));

            expect((await child(user._id, childId)).date_of_birth).toBeDefined();
        });
    });

    it("touches only the addressed child when the user has several", async () => {
        const { user, childId } = await setup();

        // Finish the first child, so resolveSubjectChild has no draft left to resume and
        // genuinely opens a second one. Calling it twice against an unfinished draft
        // correctly returns the SAME child — that is the leak guard, covered below.
        await markChildOnboardingComplete(user._id.toString(), childId);

        const reloaded = await UserModel.findById(user._id);
        const other = await resolveSubjectChild(reloaded!, undefined);
        expect(other.childId.toString()).not.toBe(childId.toString());

        await updateChildOnboardingData(
            user._id.toString(),
            other.childId,
            await getNode("child_name"),
            undefined,
            "Meera",
        );

        const first = await child(user._id, childId);
        expect(first.name).toBeUndefined();
    });

    it("never stacks up draft children when a start is repeated", async () => {
        // The child is pushed before the flow instance exists, so resumption has to key
        // off the draft child itself. Keying off the instance leaked a child every time
        // instance creation failed, or whenever two starts raced.
        const { user, childId } = await setup();

        for (let i = 0; i < 3; i++) {
            const reloaded = await UserModel.findById(user._id);
            const again = await resolveSubjectChild(reloaded!, undefined);
            expect(again.created).toBe(false);
            expect(again.childId.toString()).toBe(childId.toString());
        }

        const fresh = await UserModel.findById(user._id).lean();
        expect(fresh!.childs).toHaveLength(1);
    });

    it("records child_name on the instance so later questions can interpolate it", async () => {
        const { user, childId } = await setup();

        await flowInstanceModel.create({
            userId: user._id,
            conversationId: new Types.ObjectId(),
            flowDefId: new Types.ObjectId(),
            flowSlug: BABY_ONBOARDING_SLUG,
            version: 1,
            postpartumWeek: 1,
            subjectChildId: childId,
            state: FlowInstanceStateEnum.ACTIVE,
            variables: {},
        });

        await updateChildOnboardingData(
            user._id.toString(),
            childId,
            await getNode("child_name"),
            undefined,
            "Aarav",
        );

        const instance = await flowInstanceModel.findOne({ subjectChildId: childId }).lean();
        expect(instance!.variables.child_name).toBe("Aarav");

        const dobNode = await getNode("child_dob");
        expect(interpolateFlowText(dobNode.text, instance!.variables)).toBe(
            "When was Aarav born?",
        );
    });

    it("completing a child does NOT complete the mother's questionnaire", async () => {
        const { user, childId } = await setup();

        await markChildOnboardingComplete(user._id.toString(), childId);

        const fresh = await UserModel.findById(user._id).lean();
        const saved = fresh!.childs.find((c) => c._id!.toString() === childId.toString())!;

        expect(saved.onboarding_status).toBe(EChildOnboardingStatus.COMPLETED);
        expect(saved.onboarded_at).toBeInstanceOf(Date);
        expect(fresh!.is_onboarded?.is_questionnaire_completed).not.toBe(true);
    });
});

describe("interpolateFlowText", () => {
    it("leaves an unresolved token alone rather than printing undefined", () => {
        expect(interpolateFlowText("When was {{child_name}} born?", {})).toBe(
            "When was {{child_name}} born?",
        );
    });

    it("passes untokenised mother-flow copy through untouched", () => {
        const text = "How did you give birth?";
        expect(interpolateFlowText(text, { child_name: "Aarav" })).toBe(text);
    });
});
