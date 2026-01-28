"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
jest.mock(require.resolve("../src/config/firebase"), () => ({ __esModule: true, default: null }));
jest.mock(require.resolve("../src/config/redis.config"), () => ({ __esModule: true }));
// Middleware ENFORCING query param 'token'
jest.mock(require.resolve("../src/middlewares/authorization.middleware"), () => jest.fn((mode) => (req, res, next) => {
    if (mode === "query" && !req.query?.token) {
        return res.status(401).json({ error: "token missing" });
    }
    next();
}));
jest.mock(require.resolve("../src/api/v1/controllers/chat-system/chat-flow.controller"), () => jest.fn().mockImplementation(() => ({
    handleSseConnection: (req, res) => res.status(200).json({ ok: true }),
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
describe("GET /api/v1/chat-session/:slug - missing query token", () => {
    it("401 when query token missing", async () => {
        const res = await (0, supertest_1.default)(app_1.default).get("/api/v1/chat-session/mySlug");
        expect(res.status).toBe(401);
        expect(res.body).toEqual({ error: "token missing" });
    });
    it("200 when token provided", async () => {
        const res = await (0, supertest_1.default)(app_1.default).get("/api/v1/chat-session/mySlug").query({ token: "abc" });
        expect(res.status).toBe(200);
        expect(res.body).toEqual({ ok: true });
    });
});
//# sourceMappingURL=chatFlow_handleSession_noAuthQuery.test.js.map