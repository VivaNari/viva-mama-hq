jest.mock(require.resolve("../src/config/firebase"), () => ({ __esModule: true, default: null }));

jest.mock(require.resolve("../src/config/redis.config"), () => ({
    __esModule: true,
    redisPublisher: null,
    redisSubscriber: null,
}));

jest.mock(require.resolve("../src/middlewares/authorization.middleware"), () =>
    jest.fn(() => (req: any, res: any, next: any) => next()),
);

// Mock controller
jest.mock(require.resolve("../src/api/v1/controllers/payments/payment.controller"), () => {
    return jest.fn().mockImplementation(() => ({
        createOrder: () => {},
        selectFreePlan: () => {},

        verifyPayment: (req: any, res: any) => {
            const sig = req.body?.razorpay_signature;
            if (!sig || sig === "bad") {
                return res.status(403).json({ error: "Invalid signature" });
            }
            return res.status(200).json({ verified: true });
        },
    }));
});

import request from "supertest";
import app from "../src/app";

describe("POST /api/v1/orders/verify", () => {
    it("403 on invalid signature", async () => {
        const res = await request(app)
            .post("/api/v1/orders/verify")
            .send({ razorpay_signature: "bad" });
        expect(res.status).toBe(403);
        expect(res.body).toEqual({ error: "Invalid signature" });
    });

    it("200 on valid signature", async () => {
        const res = await request(app)
            .post("/api/v1/orders/verify")
            .send({ razorpay_signature: "good" });
        expect(res.status).toBe(200);
        expect(res.body).toEqual({ verified: true });
    });
});
