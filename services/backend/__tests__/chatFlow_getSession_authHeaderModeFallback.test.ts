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
jest.mock(require.resolve("../src/middlewares/authorization.middleware"), () =>
    jest.fn((mode: string) => (req: any, res: any, next: any) => {
        if (mode === "query") {
            if (!req.query?.token && !req.headers["x-user"]) {
                return res.status(401).json({ error: "Auth missing" });
            }
        }
        next();
    }),
);

jest.mock(require.resolve("../src/api/v1/controllers/chat-system/chat-flow.controller"), () =>
    jest.fn().mockImplementation(() => ({
        handleSseConnection: (_req: any, res: any) =>
            res.status(200).json({ ok: true, via: "fallback-header" }),
        saveResponse: () => {},
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

describe("GET /api/v1/chat-session/:slug with header-based fallback auth", () => {
    it("401 when both token + header missing", async () => {
        const res = await request(app).get("/api/v1/chat-session/topic1");
        expect(res.status).toBe(401);
        expect(res.body).toEqual({ error: "Auth missing" });
    });

    it("200 when x-user header present (fallback)", async () => {
        const res = await request(app).get("/api/v1/chat-session/topic1").set("x-user", "u1");

        expect(res.status).toBe(200);
        expect(res.body).toEqual({ ok: true, via: "fallback-header" });
    });
});
