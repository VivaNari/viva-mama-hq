/**
 * Logging from the Viva AI chat: the chatbot proposes ("today my bp is 118/80"),
 * this server validates, and nothing is saved until she confirms.
 *
 * Asserted against a real in-memory Mongo, because the guarantees that matter here are
 * about the database: a proposal saves exactly once however it is confirmed (tap, double
 * tap, typed "haan"), and only into her own logs.
 *
 * Run:  npx jest chatLogProposals
 */

jest.mock(require.resolve("../src/config/firebase"), () => ({ __esModule: true, default: null }));
jest.mock(require.resolve("../src/config/redis.config"), () => ({ __esModule: true }));
jest.mock("razorpay", () =>
    jest.fn().mockImplementation(() => ({ orders: { create: jest.fn() } })),
);
// The chatbot service is never called for real; each test says what it answers.
const mockSendUserQuery = jest.fn();
jest.mock("../src/services/llm/llm.service", () => ({
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
        sendUserQuery: mockSendUserQuery,
        sendNameQuery: jest.fn(),
    })),
}));

import jwt from "jsonwebtoken";
import request from "supertest";
import { Types } from "mongoose";

import { clearTestDb, closeTestDb, connectTestDb } from "./helpers/db";
import app from "../src/app";
import env from "../src/config/env";
import conversationModel from "../src/models/conversation.model";
import messageModel from "../src/models/message.model";
import motherLogModel from "../src/models/mother-log.model";
import motherMedicineModel from "../src/models/mother-medicine.model";
import UserModel from "../src/models/user.model";
import ChatFlowAIService from "../src/services/chat-system/chat-flow-ai.service";
import { getISTCalendarDate } from "../src/services/date/date.service";
import ChatLogProposalService, {
    parseConfirmReply,
} from "../src/services/mother-log/chat-log-proposal.service";
import { MessageRoleEnum, MessageTypeEnum } from "../src/types/chat.types";
import { EUserCategory } from "../src/types/user.types";

jest.setTimeout(120000);

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const service = new ChatLogProposalService();

async function createMother() {
    const user = await UserModel.create({
        mobile_number: `9${Math.floor(100000000 + Math.random() * 899999999)}`,
        user_category: EUserCategory.NP,
        onboarding_data: { preferred_name: "Asha" },
    });
    return user._id.toString();
}

/** An assistant message carrying the given proposals as its confirm card. */
async function cardMessage(userId: string, raw: unknown[], createdAt?: Date) {
    const conversation = await conversationModel.create({ userId, title: "Chat", chatMode: "AI_ONLY" });
    const pendingLogs = await service.prepare(userId, raw);
    const message = await messageModel.create({
        conversationId: conversation._id,
        userId,
        role: MessageRoleEnum.ASSITANT,
        type: MessageTypeEnum.AI,
        text: "Shall I save this for today?",
        pendingLogs,
        ...(createdAt ? { createdAt } : {}),
    });
    return {
        conversationId: String(conversation._id),
        messageId: String(message._id),
        proposalIds: pendingLogs.map((p) => String(p._id)),
    };
}

beforeAll(connectTestDb);
afterAll(closeTestDb);
beforeEach(clearTestDb);

describe("preparing proposals", () => {
    it("keeps valid proposals and drops malformed ones", async () => {
        const userId = await createMother();
        const items = await service.prepare(userId, [
            { logType: "bp", fields: { systolic: 118, diastolic: 80 } },
            { logType: "bp", fields: { systolic: 1300, diastolic: 80 } },
            { logType: "anc_schedule_item", fields: { itemId: "g1a" } },
            { logType: "sugar", fields: { value: 110 } },
        ]);

        expect(items).toHaveLength(1);
        expect(items[0]?.logType).toBe("bp");
        expect(items[0]?.status).toBe("pending");
    });

    it("returns nothing for a missing or non-list payload", async () => {
        const userId = await createMother();
        expect(await service.prepare(userId, undefined)).toEqual([]);
        expect(await service.prepare(userId, { logType: "bp" })).toEqual([]);
    });

    it("defaults a water proposal to adding", async () => {
        const userId = await createMother();
        const [item] = await service.prepare(userId, [{ logType: "water", fields: { glasses: 2 } }]);
        expect(item?.mode).toBe("add");
    });

    it("matches a medicine on her list, and flags one that is not", async () => {
        const userId = await createMother();
        const ifa = await motherMedicineModel.create({
            userId,
            presetKey: "iron_folic_acid",
            frequency: "once_a_day",
        });

        const [onList, offList] = await service.prepare(userId, [
            { logType: "medicine_dose", fields: {}, medicineRef: { presetKey: "iron_folic_acid" } },
            { logType: "medicine_dose", fields: {}, medicineRef: { name: "Thyronorm" } },
        ]);

        expect(onList?.status).toBe("pending");
        expect(String(onList?.medicineId)).toBe(String(ifa._id));
        expect(offList?.status).toBe("needs_medicine");
    });
});

describe("confirming", () => {
    it("saves the reading as a chat log, once", async () => {
        const userId = await createMother();
        const { messageId, proposalIds } = await cardMessage(userId, [
            { logType: "bp", fields: { systolic: 118, diastolic: 80 } },
        ]);
        const proposalId = proposalIds[0]!;

        const first = await service.confirm({ userId, messageId, proposalId, accept: true });
        const again = await service.confirm({ userId, messageId, proposalId, accept: true });

        expect(first.result).toBe("ok");
        expect(again.result).toBe("ok");
        const logs = await motherLogModel.find({ userId, logType: "bp" });
        expect(logs).toHaveLength(1);
        expect(logs[0]?.source).toBe("chat");
        expect(logs[0]?.fields).toEqual({ systolic: 118, diastolic: 80 });

        const card = await messageModel.findById(messageId).lean();
        expect(card?.pendingLogs?.[0]?.status).toBe("saved");
        expect(String(card?.pendingLogs?.[0]?.savedLogId)).toBe(String(logs[0]?._id));
    });

    it("writes once when two taps race", async () => {
        const userId = await createMother();
        const { messageId, proposalIds } = await cardMessage(userId, [
            { logType: "hb", fields: { value: 10.2 } },
        ]);
        const proposalId = proposalIds[0]!;

        await Promise.all([
            service.confirm({ userId, messageId, proposalId, accept: true }),
            service.confirm({ userId, messageId, proposalId, accept: true }),
        ]);

        expect(await motherLogModel.countDocuments({ userId, logType: "hb" })).toBe(1);
    });

    it("saves nothing when she says no", async () => {
        const userId = await createMother();
        const { messageId, proposalIds } = await cardMessage(userId, [
            { logType: "weight", fields: { weightKg: 61.5 } },
        ]);

        const outcome = await service.confirm({ userId, messageId, proposalId: proposalIds[0]!, accept: false });

        expect(outcome.result === "ok" && outcome.item.status).toBe("dismissed");
        expect(await motherLogModel.countDocuments({ userId })).toBe(0);
    });

    it("treats another mother's card as not found", async () => {
        const owner = await createMother();
        const other = await createMother();
        const { messageId, proposalIds } = await cardMessage(owner, [
            { logType: "bp", fields: { systolic: 120, diastolic: 80 } },
        ]);

        const outcome = await service.confirm({
            userId: other,
            messageId,
            proposalId: proposalIds[0]!,
            accept: true,
        });

        expect(outcome.result).toBe("not_found");
        expect(await motherLogModel.countDocuments({})).toBe(0);
    });

    it("refuses a card from an earlier day", async () => {
        const userId = await createMother();
        const yesterday = new Date(getISTCalendarDate().getTime() - MS_PER_DAY);
        const { messageId, proposalIds } = await cardMessage(
            userId,
            [{ logType: "bp", fields: { systolic: 120, diastolic: 80 } }],
            yesterday,
        );

        const outcome = await service.confirm({ userId, messageId, proposalId: proposalIds[0]!, accept: true });

        expect(outcome.result).toBe("day_closed");
        expect(await motherLogModel.countDocuments({ userId })).toBe(0);
    });

    it("adds water to today's total, or sets it", async () => {
        const userId = await createMother();
        await motherLogModel.create({
            userId,
            logType: "water",
            isDailyTotal: true,
            fields: { glasses: 3 },
            logDate: getISTCalendarDate(),
            loggedAt: new Date(),
        });

        const added = await cardMessage(userId, [{ logType: "water", fields: { glasses: 2 } }]);
        await service.confirm({ userId, messageId: added.messageId, proposalId: added.proposalIds[0]!, accept: true });
        let day = await motherLogModel.findOne({ userId, logType: "water" });
        expect(day?.fields.glasses).toBe(5);

        const set = await cardMessage(userId, [{ logType: "water", fields: { glasses: 7 }, mode: "set" }]);
        await service.confirm({ userId, messageId: set.messageId, proposalId: set.proposalIds[0]!, accept: true });
        day = await motherLogModel.findOne({ userId, logType: "water" });
        expect(day?.fields.glasses).toBe(7);
        expect(await motherLogModel.countDocuments({ userId, logType: "water" })).toBe(1);
    });

    it("marks a medicine on her list as taken", async () => {
        const userId = await createMother();
        await motherMedicineModel.create({ userId, presetKey: "calcium", frequency: "twice_a_day" });
        const { messageId, proposalIds } = await cardMessage(userId, [
            { logType: "medicine_dose", fields: {}, medicineRef: { presetKey: "calcium" } },
        ]);

        await service.confirm({ userId, messageId, proposalId: proposalIds[0]!, accept: true });

        const dose = await motherLogModel.findOne({ userId, logType: "medicine_dose" });
        expect(dose?.source).toBe("chat");
    });
});

describe("a typed yes or no", () => {
    it("recognises plain confirmations in English, Hinglish and Hindi only", () => {
        expect(parseConfirmReply("yes")).toBe("yes");
        expect(parseConfirmReply("Haan ji")).toBe("yes");
        expect(parseConfirmReply("हाँ")).toBe("yes");
        expect(parseConfirmReply("nahi")).toBe("no");
        expect(parseConfirmReply("yes, but is 140/90 high?")).toBeNull();
        expect(parseConfirmReply("my bp is 118/80")).toBeNull();
    });

    it("answers the waiting card without calling the chatbot", async () => {
        const userId = await createMother();
        const { conversationId, messageId } = await cardMessage(userId, [
            { logType: "bp", fields: { systolic: 118, diastolic: 80 } },
        ]);
        mockSendUserQuery.mockReset();

        const user = await UserModel.findById(userId);
        await new ChatFlowAIService().processChatbotResponse(
            user as never,
            "haan",
            "session-1",
            new Types.ObjectId(conversationId) as never,
            "default",
        );

        expect(mockSendUserQuery).not.toHaveBeenCalled();
        expect(await motherLogModel.countDocuments({ userId, logType: "bp" })).toBe(1);
        const card = await messageModel.findById(messageId).lean();
        expect(card?.pendingLogs?.[0]?.status).toBe("saved");
        const reply = await messageModel
            .findOne({ conversationId, role: MessageRoleEnum.ASSITANT, _id: { $ne: messageId } })
            .lean();
        expect(reply?.text).toContain("Saved");
    });

    it("goes to the chatbot as usual when nothing is waiting", async () => {
        const userId = await createMother();
        const conversation = await conversationModel.create({ userId, title: "Chat", chatMode: "AI_ONLY" });
        mockSendUserQuery.mockReset().mockResolvedValue({ answer: "Hello!", proposed_logs: [] });

        const user = await UserModel.findById(userId);
        await new ChatFlowAIService().processChatbotResponse(
            user as never,
            "yes",
            "session-1",
            conversation._id as never,
            "default",
        );

        expect(mockSendUserQuery).toHaveBeenCalled();
    });

    it("attaches validated proposals from the chatbot to its reply", async () => {
        const userId = await createMother();
        const conversation = await conversationModel.create({ userId, title: "Chat", chatMode: "AI_ONLY" });
        mockSendUserQuery.mockReset().mockResolvedValue({
            answer: "Got it. Shall I save this for today?",
            proposed_logs: [
                { logType: "bp", fields: { systolic: 118, diastolic: 80 } },
                { logType: "bp", fields: { systolic: "high" } },
            ],
        });

        const user = await UserModel.findById(userId);
        await new ChatFlowAIService().processChatbotResponse(
            user as never,
            "today my bp is 118/80",
            "session-1",
            conversation._id as never,
            "default",
        );

        const reply = await messageModel
            .findOne({ conversationId: conversation._id, role: MessageRoleEnum.ASSITANT })
            .lean();
        expect(reply?.pendingLogs).toHaveLength(1);
        expect(reply?.pendingLogs?.[0]?.status).toBe("pending");
        // Proposed, not saved.
        expect(await motherLogModel.countDocuments({ userId })).toBe(0);
    });
});

describe("the confirm route", () => {
    it("saves through POST /chat/log-proposals/confirm", async () => {
        const userId = await createMother();
        const auth = `Bearer ${jwt.sign({ _id: userId }, env.JWT_SECRET as string)}`;
        const { messageId, proposalIds } = await cardMessage(userId, [
            { logType: "sugar", fields: { value: 92, timing: "fasting" } },
        ]);

        const res = await request(app)
            .post("/api/v1/chat/log-proposals/confirm")
            .set("Authorization", auth)
            .send({ messageId, proposalId: proposalIds[0], accept: true });

        expect(res.status).toBe(200);
        expect(res.body.data.status).toBe("saved");
        expect(await motherLogModel.countDocuments({ userId, logType: "sugar", source: "chat" })).toBe(1);

        const bad = await request(app)
            .post("/api/v1/chat/log-proposals/confirm")
            .set("Authorization", auth)
            .send({ messageId, proposalId: "nope", accept: true });
        expect(bad.status).toBe(400);
    });
});
