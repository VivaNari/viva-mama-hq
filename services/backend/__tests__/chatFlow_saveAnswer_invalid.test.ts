jest.mock(require.resolve("../src/config/firebase"), () => ({ __esModule: true, default: null }));
jest.mock(require.resolve("../src/config/redis.config"), () => ({ __esModule: true }));
jest.mock(require.resolve("../src/middlewares/authorization.middleware"), () =>
    jest.fn(() => (req: any, res: any, next: any) => next()),
);

jest.mock(require.resolve("../src/api/v1/controllers/chat-system/chat-flow.controller"), () =>
    jest.fn().mockImplementation(() => ({
        handleSseConnection: () => {},
        saveAnswer: (req: any, res: any) => {
            if (!req.body?.answer) {
                return res.status(422).json({ error: "answer required" });
            }
            return res.status(201).json({ saved: true });
        },
    })),
);

jest.mock("razorpay", () => {
    return jest.fn().mockImplementation(() => ({
        orders: { create: jest.fn(), fetch: jest.fn() },
        payments: { fetch: jest.fn() },
    }));
});

import request from "supertest";
import app from "../src/app";

describe("POST /api/v1/chat-flow/answer - invalid body", () => {
    it("422 when missing answer", async () => {
        const res = await request(app)
            .post("/api/v1/chat-flow/answer")
            .set("x-user", "abc")
            .send({});
        expect(res.status).toBe(422);
        expect(res.body).toEqual({ error: "answer required" });
    });

    it("201 on valid answer", async () => {
        const res = await request(app)
            .post("/api/v1/chat-flow/answer")
            .set("x-user", "abc")
            .send({ answer: "Yes" });
        expect(res.status).toBe(201);
        expect(res.body).toEqual({ saved: true });
    });
});
