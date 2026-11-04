/**
 * The Devanagari copy of a Hinglish reply, used to read it aloud: signed-in users only,
 * bounded in size, and a chatbot failure reaches the app without echoing her reply.
 *
 * Run:  npx jest chatSpeechText
 */

jest.mock(require.resolve("../src/config/firebase"), () => ({ __esModule: true, default: null }));
jest.mock(require.resolve("../src/config/redis.config"), () => ({ __esModule: true }));
jest.mock("razorpay", () =>
    jest.fn().mockImplementation(() => ({ orders: { create: jest.fn() } })),
);
const mockTransliterate = jest.fn();
jest.mock("../src/services/llm/llm.service", () => ({
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
        sendUserQuery: jest.fn(),
        sendNameQuery: jest.fn(),
        transliterateForSpeech: mockTransliterate,
    })),
}));

import jwt from "jsonwebtoken";
import request from "supertest";

import { clearTestDb, closeTestDb, connectTestDb } from "./helpers/db";
import app from "../src/app";
import env from "../src/config/env";
import UserModel from "../src/models/user.model";
import { EUserCategory } from "../src/types/user.types";

jest.setTimeout(120000);

const URL = "/api/v1/chat-flow/speech-text";
const HINGLISH = "Aapko aaram karna chahiye";

const authHeader = async () => {
    const user = await UserModel.create({
        mobile_number: `9${Math.floor(100000000 + Math.random() * 899999999)}`,
        user_category: EUserCategory.NP,
        onboarding_data: { preferred_name: "Asha" },
    });
    return `Bearer ${jwt.sign({ _id: user._id.toString() }, env.JWT_SECRET as string)}`;
};

describe("POST /chat-flow/speech-text", () => {
    beforeAll(connectTestDb);
    afterEach(async () => {
        await clearTestDb();
        mockTransliterate.mockReset();
    });
    afterAll(closeTestDb);

    it("returns the Devanagari copy", async () => {
        mockTransliterate.mockResolvedValueOnce("आपको आराम करना चाहिए");
        const res = await request(app)
            .post(URL)
            .set("Authorization", await authHeader())
            .send({ text: HINGLISH });
        expect(res.status).toBe(200);
        expect(res.body.data.text).toBe("आपको आराम करना चाहिए");
        expect(mockTransliterate).toHaveBeenCalledWith(HINGLISH, expect.any(String));
    });

    it("refuses a request without a token", async () => {
        const res = await request(app).post(URL).send({ text: HINGLISH });
        expect(res.status).toBe(401);
        expect(mockTransliterate).not.toHaveBeenCalled();
    });

    it.each([
        ["empty", ""],
        ["oversized", "a".repeat(10001)],
    ])("rejects %s text", async (_name, text) => {
        const res = await request(app)
            .post(URL)
            .set("Authorization", await authHeader())
            .send({ text });
        expect(res.status).toBe(400);
        expect(mockTransliterate).not.toHaveBeenCalled();
    });

    it("reports a chatbot failure without echoing her reply", async () => {
        mockTransliterate.mockRejectedValueOnce(
            Object.assign(new Error(HINGLISH), { response: { status: 502 } }),
        );
        const res = await request(app)
            .post(URL)
            .set("Authorization", await authHeader())
            .send({ text: HINGLISH });
        expect(res.status).toBe(502);
        expect(res.body.data).toBeNull();
        expect(res.text).not.toContain("Aapko");
    });
});
