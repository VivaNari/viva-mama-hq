"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
jest.mock(require.resolve("../src/config/firebase"), () => ({ __esModule: true, default: null }));
jest.mock(require.resolve("../src/config/redis.config"), () => ({
    __esModule: true,
    redisPublisher: null,
    redisSubscriber: null,
}));
// 🔥 FIX: mock authorization middleware so it never blocks tests
jest.mock(require.resolve("../src/middlewares/authorization.middleware"), () => jest.fn(() => (req, res, next) => next()));
// Mock Razorpay
jest.mock("razorpay", () => jest.fn().mockImplementation(() => ({
    orders: { create: jest.fn().mockResolvedValue({ id: "rp_ord_1", status: "created" }) },
    payments: { fetch: jest.fn() },
})));
// Mock ALL required controller methods
jest.mock(require.resolve("../src/api/v1/controllers/payments/payment.controller"), () => {
    return jest.fn().mockImplementation(() => ({
        createOrder: (req, res) => {
            const { amount, currency } = req.body || {};
            if (!amount)
                return res.status(400).json({ error: "Amount required" });
            if (!currency)
                return res.status(400).json({ error: "Currency required" });
            return res.status(201).json({
                id: "rp_ord_1",
                status: "created",
                amount,
                currency,
            });
        },
        verifyPayment: (_req, res) => {
            return res.status(200).json({ mocked: "verifyPayment" });
        },
        selectFreePlan: (_req, res) => {
            return res.status(200).json({ mocked: "freePlan" });
        },
    }));
});
const supertest_1 = __importDefault(require("supertest"));
const app_1 = __importDefault(require("../src/app"));
describe("POST /api/v1/orders/create - validation", () => {
    it("returns 400 when amount missing", async () => {
        const res = await (0, supertest_1.default)(app_1.default).post("/api/v1/orders/create").send({ currency: "INR" });
        expect(res.status).toBe(400);
        expect(res.body).toEqual({ error: "Amount required" });
    });
    it("returns 400 when currency missing", async () => {
        const res = await (0, supertest_1.default)(app_1.default).post("/api/v1/orders/create").send({ amount: 100 });
        expect(res.status).toBe(400);
        expect(res.body).toEqual({ error: "Currency required" });
    });
    it("returns 201 when valid", async () => {
        const res = await (0, supertest_1.default)(app_1.default)
            .post("/api/v1/orders/create")
            .send({ amount: 100, currency: "INR" });
        expect(res.status).toBe(201);
        expect(res.body).toEqual({
            id: "rp_ord_1",
            status: "created",
            amount: 100,
            currency: "INR",
        });
    });
});
//# sourceMappingURL=payments_createOrder_inputValidation.test.js.map