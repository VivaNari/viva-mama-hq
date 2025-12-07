"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
jest.mock(require.resolve("../src/config/firebase"), () => ({ __esModule: true, default: null }));
jest.mock(require.resolve("../src/config/redis.config"), () => ({ __esModule: true }));
jest.mock(require.resolve("../src/middlewares/authorization.middleware"), () => jest.fn(() => (_req, _res, next) => next()));
jest.mock(require.resolve("../src/api/v1/controllers/questions/question.controller"), () => jest.fn().mockImplementation(() => ({
    getQuestions: (_req, res) => res.status(200).json({ items: ["Q1", "Q2"] }),
    saveQuestion: () => { },
})));
jest.mock("razorpay", () => {
    return jest.fn().mockImplementation(() => ({
        orders: { create: jest.fn(), fetch: jest.fn() },
        payments: { fetch: jest.fn() },
    }));
});
const supertest_1 = __importDefault(require("supertest"));
const app_1 = __importDefault(require("../src/app"));
describe("GET /api/v1/questions", () => {
    it("returns all questions", async () => {
        const res = await (0, supertest_1.default)(app_1.default).get("/api/v1/questions");
        expect(res.status).toBe(200);
        expect(res.body).toEqual({ items: ["Q1", "Q2"] });
    });
});
//# sourceMappingURL=questions_list.test.js.map