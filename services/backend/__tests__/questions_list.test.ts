jest.mock(require.resolve("../src/config/firebase"), () => ({ __esModule: true, default: null }));
jest.mock(require.resolve("../src/config/redis.config"), () => ({ __esModule: true }));
jest.mock(require.resolve("../src/middlewares/authorization.middleware"), () =>
    jest.fn(() => (_req: any, _res: any, next: any) => next()),
);

jest.mock(require.resolve("../src/api/v1/controllers/questions/question.controller"), () =>
    jest.fn().mockImplementation(() => ({
        getQuestions: (_req: any, res: any) => res.status(200).json({ items: ["Q1", "Q2"] }),
        saveQuestion: () => {},
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

describe("GET /api/v1/questions", () => {
    it("returns all questions", async () => {
        const res = await request(app).get("/api/v1/questions");
        expect(res.status).toBe(200);
        expect(res.body).toEqual({ items: ["Q1", "Q2"] });
    });
});
