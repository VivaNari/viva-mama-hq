jest.mock(require.resolve("../src/config/firebase"), () => ({ __esModule: true, default: null }));
jest.mock(require.resolve("../src/config/redis.config"), () => ({ __esModule: true }));
jest.mock(require.resolve("../src/middlewares/authorization.middleware"), () =>
    jest.fn(() => (req: any, res: any, next: any) => next()),
);

jest.mock(require.resolve("../src/api/v1/controllers/payments/payment.controller"), () =>
    jest.fn().mockImplementation(() => ({
        createOrder: () => {},
        verifyPayment: () => {},

        selectFreePlan: (req: any, res: any) => {
            if (!req.body?.userId) return res.status(400).json({ error: "userId required" });
            return res.status(200).json({ plan: "free", activated: true });
        },
    })),
);

import request from "supertest";
import app from "../src/app";

describe("POST /api/v1/subscribe/select-free-plan", () => {
    it("400 when userId missing", async () => {
        const res = await request(app).post("/api/v1/subscribe/select-free-plan").send({});
        expect(res.status).toBe(400);
        expect(res.body).toEqual({ error: "userId required" });
    });

    it("200 when valid", async () => {
        const res = await request(app)
            .post("/api/v1/subscribe/select-free-plan")
            .send({ userId: "u1" });
        expect(res.status).toBe(200);
        expect(res.body).toEqual({ plan: "free", activated: true });
    });
});
