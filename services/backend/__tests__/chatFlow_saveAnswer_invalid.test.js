"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
jest.mock(require.resolve("../src/config/firebase"), () => ({ __esModule: true, default: null }));
jest.mock(require.resolve("../src/config/redis.config"), () => ({ __esModule: true }));
jest.mock(require.resolve("../src/middlewares/authorization.middleware"), () => jest.fn(() => (req, res, next) => next()));
jest.mock(require.resolve("../src/api/v1/controllers/chat-system/chat-flow.controller"), () => jest.fn().mockImplementation(() => ({
    handleSseConnection: () => { },
    saveAnswer: (req, res) => {
        if (!req.body?.answer) {
            return res.status(422).json({ error: "answer required" });
        }
        return res.status(201).json({ saved: true });
    },
})));
jest.mock("razorpay", () => {
    return jest.fn().mockImplementation(() => ({
        orders: { create: jest.fn(), fetch: jest.fn() },
        payments: { fetch: jest.fn() },
    }));
});
const supertest_1 = __importDefault(require("supertest"));
const app_1 = __importDefault(require("../src/app"));
describe("POST /api/v1/chat-flow/answer - invalid body", () => {
    it("422 when missing answer", async () => {
        const res = await (0, supertest_1.default)(app_1.default)
            .post("/api/v1/chat-flow/answer")
            .set("x-user", "abc")
            .send({});
        expect(res.status).toBe(422);
        expect(res.body).toEqual({ error: "answer required" });
    });
    it("201 on valid answer", async () => {
        const res = await (0, supertest_1.default)(app_1.default)
            .post("/api/v1/chat-flow/answer")
            .set("x-user", "abc")
            .send({ answer: "Yes" });
        expect(res.status).toBe(201);
        expect(res.body).toEqual({ saved: true });
    });
});
//# sourceMappingURL=chatFlow_saveAnswer_invalid.test.js.map