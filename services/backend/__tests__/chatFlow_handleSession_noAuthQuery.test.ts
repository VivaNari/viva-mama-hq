jest.mock(require.resolve("../src/config/firebase"), () => ({ __esModule: true, default: null }));
jest.mock(require.resolve("../src/config/redis.config"), () => ({ __esModule: true }));

// Middleware ENFORCING query param 'token'
jest.mock(require.resolve("../src/middlewares/authorization.middleware"), () =>
    jest.fn((mode: string) => (req: any, res: any, next: any) => {
        if (mode === "query" && !req.query?.token) {
            return res.status(401).json({ error: "token missing" });
        }
        next();
    }),
);

jest.mock(require.resolve("../src/api/v1/controllers/chat-system/chat-flow.controller"), () =>
    jest.fn().mockImplementation(() => ({
        handleSseConnection: (req: any, res: any) => res.status(200).json({ ok: true }),
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

describe("GET /api/v1/chat-session/:slug - missing query token", () => {
    it("401 when query token missing", async () => {
        const res = await request(app).get("/api/v1/chat-session/mySlug");

        expect(res.status).toBe(401);
        expect(res.body).toEqual({ error: "token missing" });
    });

    it("200 when token provided", async () => {
        const res = await request(app).get("/api/v1/chat-session/mySlug").query({ token: "abc" });

        expect(res.status).toBe(200);
        expect(res.body).toEqual({ ok: true });
    });
});
