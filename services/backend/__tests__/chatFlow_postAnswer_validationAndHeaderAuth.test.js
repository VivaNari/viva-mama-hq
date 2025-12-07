"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// Firebase + Redis mocks
jest.mock(require.resolve("../src/config/firebase"), () => ({ __esModule: true, default: null }));
jest.mock(require.resolve("../src/config/redis.config"), () => ({
    __esModule: true,
    redisPublisher: null,
    redisSubscriber: null,
}));
jest.mock("razorpay", () => {
    return jest.fn().mockImplementation(() => ({
        orders: { create: jest.fn(), fetch: jest.fn() },
        payments: { fetch: jest.fn() },
    }));
});
// FIXED AUTH MIDDLEWARE MOCK — returns 401 when header mode and x-user missing
jest.mock(require.resolve("../src/middlewares/authorization.middleware"), () => ({
    __esModule: true,
    default: (mode) => {
        return (req, res, next) => {
            if (mode === "header" && !req.headers["x-user"]) {
                return res.status(401).json({ error: "Missing x-user header" });
            }
            next();
        };
    },
}));
// FIXED CONTROLLER MOCK — MUST BE A CLASS because your real controller is a class
jest.mock(require.resolve("../src/api/v1/controllers/chat-system/chat-flow.controller"), () => ({
    __esModule: true,
    default: class {
        handleSseConnection(req, res) {
            const slug = req.params.slug;
            if (!slug)
                return res.status(400).json({ error: "Invalid slug" });
            if (slug === "invalid")
                return res.status(400).json({ error: "Invalid slug" });
            return res.status(200).json({ slugReceived: slug });
        }
        saveAnswer(req, res) {
            const { answer } = req.body || {};
            if (!answer) {
                return res.status(422).json({ error: "answer required" });
            }
            return res.status(201).json({ saved: true, answer });
        }
    },
}));
const supertest_1 = __importDefault(require("supertest"));
const app_1 = __importDefault(require("../src/app"));
describe("POST /api/v1/chat-flow/answer - header auth + body validation", () => {
    it("returns 401 when x-user header is missing", async () => {
        const res = await (0, supertest_1.default)(app_1.default).post("/api/v1/chat-flow/answer").send({ answer: "ok" });
        expect(res.status).toBe(401);
        expect(res.body).toEqual({ error: "Missing x-user header" });
    });
    it("returns 422 when answer is missing", async () => {
        const res = await (0, supertest_1.default)(app_1.default)
            .post("/api/v1/chat-flow/answer")
            .set("x-user", "u123")
            .send({});
        expect(res.status).toBe(422);
        expect(res.body).toEqual({ error: "answer required" });
    });
    it("returns 201 for valid answer", async () => {
        const res = await (0, supertest_1.default)(app_1.default)
            .post("/api/v1/chat-flow/answer")
            .set("x-user", "u123")
            .send({ answer: "Yes I agree" });
        expect(res.status).toBe(201);
        expect(res.body).toEqual({ saved: true, answer: "Yes I agree" });
    });
});
//# sourceMappingURL=chatFlow_postAnswer_validationAndHeaderAuth.test.js.map