"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
jest.mock(require.resolve("../src/config/firebase"), () => ({ __esModule: true, default: null }));
jest.mock(require.resolve("../src/config/redis.config"), () => ({ __esModule: true }));
jest.mock(require.resolve("../src/middlewares/authorization.middleware"), () => jest.fn(() => (_req, _res, next) => next()));
jest.mock(require.resolve("../src/api/v1/controllers/chat-system/flow-node-category.controller"), () => jest.fn().mockImplementation(() => ({
    list: () => { },
    update: () => { },
    create: (req, res) => {
        if (!req.body?.name) {
            return res.status(400).json({ error: "name required" });
        }
        return res.status(201).json({ created: true });
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
describe("POST /api/v1/flow-node-categories", () => {
    it("400 when name missing", async () => {
        const res = await (0, supertest_1.default)(app_1.default).post("/api/v1/flow-node-categories").send({});
        expect(res.status).toBe(400);
        expect(res.body).toEqual({ error: "name required" });
    });
    it("201 when valid", async () => {
        const res = await (0, supertest_1.default)(app_1.default)
            .post("/api/v1/flow-node-categories")
            .send({ name: "Education" });
        expect(res.status).toBe(201);
        expect(res.body).toEqual({ created: true });
    });
});
//# sourceMappingURL=flowNodeCategory_create.test.js.map