"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
jest.mock(require.resolve("../src/config/firebase"), () => ({
    __esModule: true,
    default: null,
}));
jest.mock(require.resolve("../src/config/redis.config"), () => ({
    __esModule: true,
    redisPublisher: null,
    redisSubscriber: null,
}));
// Mock middleware so it allows fallback to header if query token missing
jest.mock(require.resolve("../src/middlewares/authorization.middleware"), () => jest.fn((mode) => (req, res, next) => {
    if (mode === "query") {
        if (!req.query?.token && !req.headers["x-user"]) {
            return res.status(401).json({ error: "Auth missing" });
        }
    }
    next();
}));
jest.mock(require.resolve("../src/api/v1/controllers/chat-system/chat-flow.controller"), () => jest.fn().mockImplementation(() => ({
    handleSseConnection: (_req, res) => res.status(200).json({ ok: true, via: "fallback-header" }),
    saveAnswer: () => { },
})));
jest.mock("razorpay", () => {
    return jest.fn().mockImplementation(() => ({
        orders: { create: jest.fn(), fetch: jest.fn() },
        payments: { fetch: jest.fn() },
    }));
});
const supertest_1 = __importDefault(require("supertest"));
const app_1 = __importDefault(require("../src/app"));
describe("GET /api/v1/chat-session/:slug with header-based fallback auth", () => {
    it("401 when both token + header missing", async () => {
        const res = await (0, supertest_1.default)(app_1.default).get("/api/v1/chat-session/topic1");
        expect(res.status).toBe(401);
        expect(res.body).toEqual({ error: "Auth missing" });
    });
    it("200 when x-user header present (fallback)", async () => {
        const res = await (0, supertest_1.default)(app_1.default).get("/api/v1/chat-session/topic1").set("x-user", "u1");
        expect(res.status).toBe(200);
        expect(res.body).toEqual({ ok: true, via: "fallback-header" });
    });
});
//# sourceMappingURL=chatFlow_getSession_authHeaderModeFallback.test.js.map