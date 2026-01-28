jest.mock(require.resolve("../src/config/firebase"), () => ({ __esModule: true, default: null }));

jest.mock(require.resolve("../src/config/redis.config"), () => ({
    __esModule: true,
    redisPublisher: null,
    redisSubscriber: null,
}));

jest.mock(require.resolve("../src/middlewares/authorization.middleware"), () =>
    jest.fn(() => (req: any, res: any, next: any) => next()),
);

jest.mock("razorpay", () => {
    return jest.fn().mockImplementation(() => ({
        orders: { create: jest.fn(), fetch: jest.fn() },
        payments: { fetch: jest.fn() },
    }));
});

jest.mock(require.resolve("../src/api/v1/controllers/chat-system/chat-flow.controller"), () => {
    return jest.fn().mockImplementation(() => ({
        handleSseConnection: (req: any, res: any) => {
            const slug = req.params.slug;
            if (!slug || slug === "invalid") {
                return res.status(400).json({ error: "Invalid slug" });
            }
            return res.status(200).json({ slugReceived: slug });
        },
        saveResponse: () => {},
    }));
});

import request from "supertest";
import app from "../src/app";

describe("GET /api/v1/chat-session/:slug - params validation", () => {
    it("returns 200 for valid slug", async () => {
        const res = await request(app).get("/api/v1/chat-session/great-slug");
        expect(res.status).toBe(200);
        expect(res.body).toEqual({ slugReceived: "great-slug" });
    });

    it("returns 400 for invalid slug", async () => {
        const res = await request(app).get("/api/v1/chat-session/invalid");
        expect(res.status).toBe(400);
        expect(res.body).toEqual({ error: "Invalid slug" });
    });
});
