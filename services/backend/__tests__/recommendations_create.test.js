"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// Mocks MUST be first
jest.mock(require.resolve("../src/config/firebase"), () => ({
    __esModule: true,
    default: null,
}));
jest.mock(require.resolve("../src/config/redis.config"), () => ({
    __esModule: true,
}));
jest.mock(require.resolve("../src/middlewares/authorization.middleware"), () => jest.fn(() => (_req, _res, next) => next()));
jest.mock("razorpay", () => {
    return jest.fn().mockImplementation(() => ({
        orders: { create: jest.fn(), fetch: jest.fn() },
        payments: { fetch: jest.fn() },
    }));
});
// ⭐ Correct controller mock (with typo "receommendation")
jest.mock(require.resolve("../src/api/v1/controllers/recommendations/receommendation.controller"), () => ({
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
        create: (req, res) => {
            if (!req.body?.title) {
                return res.status(400).json({ error: "title required" });
            }
            return res.status(201).json({ created: true });
        },
        find: jest.fn(),
    })),
}));
const supertest_1 = __importDefault(require("supertest"));
const app_1 = __importDefault(require("../src/app"));
describe("POST /api/v1/admin/recommendations", () => {
    it("400 when title missing", async () => {
        const res = await (0, supertest_1.default)(app_1.default).post("/api/v1/admin/recommendations").send({});
        expect(res.status).toBe(400);
        expect(res.body).toEqual({ error: "title required" });
    });
    it("201 when valid", async () => {
        const res = await (0, supertest_1.default)(app_1.default)
            .post("/api/v1/admin/recommendations")
            .send({ title: "New Rec" });
        expect(res.status).toBe(201);
        expect(res.body).toEqual({ created: true });
    });
});
//# sourceMappingURL=recommendations_create.test.js.map