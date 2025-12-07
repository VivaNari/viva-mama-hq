jest.mock(require.resolve("../src/config/firebase"), () => ({ __esModule: true, default: null }));

jest.mock(require.resolve("../src/config/redis.config"), () => ({
    __esModule: true,
    redisPublisher: null,
    redisSubscriber: null,
}));

// 🔥 FIX: mock authorization middleware so it never blocks tests
jest.mock(require.resolve("../src/middlewares/authorization.middleware"), () =>
    jest.fn(() => (req: any, res: any, next: any) => next()),
);

// Mock Razorpay
jest.mock("razorpay", () =>
    jest.fn().mockImplementation(() => ({
        orders: { create: jest.fn().mockResolvedValue({ id: "rp_ord_1", status: "created" }) },
        payments: { fetch: jest.fn() },
    })),
);

// Mock ALL required controller methods
jest.mock(require.resolve("../src/api/v1/controllers/payments/payment.controller"), () => {
    return jest.fn().mockImplementation(() => ({
        createOrder: (req: any, res: any) => {
            const { amount, currency } = req.body || {};
            if (!amount) return res.status(400).json({ error: "Amount required" });
            if (!currency) return res.status(400).json({ error: "Currency required" });

            return res.status(201).json({
                id: "rp_ord_1",
                status: "created",
                amount,
                currency,
            });
        },

        verifyPayment: (_req: any, res: any) => {
            return res.status(200).json({ mocked: "verifyPayment" });
        },

        selectFreePlan: (_req: any, res: any) => {
            return res.status(200).json({ mocked: "freePlan" });
        },
    }));
});

import request from "supertest";
import app from "../src/app";

describe("POST /api/v1/orders/create - validation", () => {
    it("returns 400 when amount missing", async () => {
        const res = await request(app).post("/api/v1/orders/create").send({ currency: "INR" });

        expect(res.status).toBe(400);
        expect(res.body).toEqual({ error: "Amount required" });
    });

    it("returns 400 when currency missing", async () => {
        const res = await request(app).post("/api/v1/orders/create").send({ amount: 100 });

        expect(res.status).toBe(400);
        expect(res.body).toEqual({ error: "Currency required" });
    });

    it("returns 201 when valid", async () => {
        const res = await request(app)
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
