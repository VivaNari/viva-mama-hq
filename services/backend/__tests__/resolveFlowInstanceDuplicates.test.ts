/**
 * Duplicate flow_instances: how a survivor is chosen, and the dry-run guarantee.
 *
 * The dry-run test is the important one. This step deletes user data and is registered in
 * the run-all STEPS list, which Cloud Scheduler can reach over HTTP — so "reports without
 * deleting unless explicitly told to" is a safety property, not a convenience.
 */

jest.mock(require.resolve("../src/config/firebase"), () => ({ __esModule: true, default: null }));
jest.mock(require.resolve("../src/config/redis.config"), () => ({ __esModule: true }));
jest.mock("razorpay", () =>
    jest.fn().mockImplementation(() => ({ orders: { create: jest.fn() } })),
);

import { Types } from "mongoose";

import { clearTestDb, closeTestDb, connectTestDb } from "./helpers/db";
import flowInstanceModel from "../src/models/flowInstance.model";
import flowResponseModel from "../src/models/flowResponse.model";
import messageModel from "../src/models/message.model";
import { migrate } from "../src/services/migration/steps/resolve-flow-instance-duplicates.step";
import { FlowInstanceStateEnum, MessageRoleEnum, MessageTypeEnum } from "../src/types/chat.types";

jest.setTimeout(120000);

const SLUG = "weekly-check-in-v1";

/**
 * Create an instance with `answers` recorded against it.
 *
 * Indexes are deliberately NOT synced in these tests: the whole scenario is a collection
 * that never had the unique index, so the duplicates must be insertable.
 */
async function makeInstance(opts: {
    userId: Types.ObjectId;
    conversationId: Types.ObjectId;
    answers: number;
    state?: FlowInstanceStateEnum;
    createdAt?: Date;
}) {
    const instance = await flowInstanceModel.create({
        userId: opts.userId,
        conversationId: opts.conversationId,
        flowDefId: new Types.ObjectId(),
        flowSlug: SLUG,
        version: 1,
        postpartumWeek: 1,
        state: opts.state ?? FlowInstanceStateEnum.COMPLETED,
        ...(opts.createdAt ? { createdAt: opts.createdAt } : {}),
    });

    for (let i = 0; i < opts.answers; i++) {
        await flowResponseModel.create({
            flowInstanceId: instance._id,
            flowDefId: instance.flowDefId,
            nodeId: `node_${i}`,
            answer: { answerType: "SINGLE", selectedValues: ["x"] },
        });
        await messageModel.create({
            conversationId: opts.conversationId,
            userId: opts.userId,
            role: MessageRoleEnum.ASSITANT,
            type: MessageTypeEnum.GUIDED,
            text: `q${i}`,
            guided: { flowInstanceId: instance._id, nodeId: `node_${i}`, optionKey: null },
        });
    }

    return instance;
}

beforeAll(async () => {
    await connectTestDb();
});

afterAll(async () => {
    await closeTestDb();
});

beforeEach(async () => {
    await clearTestDb();
    // Drop the unique index the helper builds, so duplicates can be planted at all.
    await flowInstanceModel.collection.dropIndexes().catch(() => undefined);
});

describe("resolve-flow-instance-duplicates", () => {
    it("deletes nothing by default", async () => {
        const userId = new Types.ObjectId();
        const conversationId = new Types.ObjectId();
        await makeInstance({ userId, conversationId, answers: 12 });
        await makeInstance({ userId, conversationId, answers: 0 });

        const result = await migrate();

        expect(result.applied).toBe(false);
        expect(result.groups).toBe(1);
        expect(result.instancesRemoved).toBe(0);
        expect(await flowInstanceModel.countDocuments()).toBe(2);
    });

    it("keeps the run with the most answers", async () => {
        const userId = new Types.ObjectId();
        const conversationId = new Types.ObjectId();
        const real = await makeInstance({ userId, conversationId, answers: 12 });
        const abandoned = await makeInstance({
            userId,
            conversationId,
            answers: 0,
            state: FlowInstanceStateEnum.ACTIVE,
        });

        await migrate({ apply: true });

        expect(await flowInstanceModel.findById(real._id)).not.toBeNull();
        expect(await flowInstanceModel.findById(abandoned._id)).toBeNull();
    });

    it("breaks a tie by keeping the older row", async () => {
        // Two identical re-submissions: the later one is the accidental repeat.
        const userId = new Types.ObjectId();
        const conversationId = new Types.ObjectId();
        const older = await makeInstance({
            userId,
            conversationId,
            answers: 12,
            createdAt: new Date("2025-12-08T12:00:00Z"),
        });
        const newer = await makeInstance({
            userId,
            conversationId,
            answers: 12,
            createdAt: new Date("2025-12-08T13:00:00Z"),
        });

        await migrate({ apply: true });

        expect(await flowInstanceModel.findById(older._id)).not.toBeNull();
        expect(await flowInstanceModel.findById(newer._id)).toBeNull();
    });

    it("keeps the surviving run's answers and transcript intact", async () => {
        // The rows share a conversation, so deleting by conversationId would take the
        // survivor's transcript too. They must be addressed by flowInstanceId.
        const userId = new Types.ObjectId();
        const conversationId = new Types.ObjectId();
        const real = await makeInstance({ userId, conversationId, answers: 12 });
        await makeInstance({ userId, conversationId, answers: 3 });

        const result = await migrate({ apply: true });

        expect(result.responsesRemoved).toBe(3);
        expect(result.messagesRemoved).toBe(3);
        expect(await flowResponseModel.countDocuments({ flowInstanceId: real._id })).toBe(12);
        expect(
            await messageModel.countDocuments({ "guided.flowInstanceId": real._id }),
        ).toBe(12);
    });

    it("leaves a user's separate weeks alone", async () => {
        const userId = new Types.ObjectId();
        const conversationId = new Types.ObjectId();
        await makeInstance({ userId, conversationId, answers: 12 });

        const week2 = await flowInstanceModel.create({
            userId,
            conversationId,
            flowDefId: new Types.ObjectId(),
            flowSlug: SLUG,
            version: 1,
            postpartumWeek: 2,
            state: FlowInstanceStateEnum.COMPLETED,
        });

        const result = await migrate({ apply: true });

        expect(result.groups).toBe(0);
        expect(await flowInstanceModel.findById(week2._id)).not.toBeNull();
    });

    it("does not treat one run per child as a duplicate", async () => {
        // A mother with two children holds two baby-onboarding rows for the same week.
        // That is the case the widened index exists to permit.
        const userId = new Types.ObjectId();
        const conversationId = new Types.ObjectId();

        for (const subjectChildId of [new Types.ObjectId(), new Types.ObjectId()]) {
            await flowInstanceModel.create({
                userId,
                conversationId,
                flowDefId: new Types.ObjectId(),
                flowSlug: "baby-onboarding-v1",
                version: 1,
                postpartumWeek: 1,
                subjectChildId,
                state: FlowInstanceStateEnum.COMPLETED,
            });
        }

        const result = await migrate({ apply: true });

        expect(result.groups).toBe(0);
        expect(await flowInstanceModel.countDocuments()).toBe(2);
    });

    it("is a no-op on a clean collection", async () => {
        const result = await migrate({ apply: true });
        expect(result.groups).toBe(0);
        expect(result.instancesRemoved).toBe(0);
    });
});
