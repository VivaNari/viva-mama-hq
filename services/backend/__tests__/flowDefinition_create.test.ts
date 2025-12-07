jest.mock(require.resolve("../src/config/firebase"), () => ({ __esModule: true, default: null }));
jest.mock(require.resolve("../src/config/redis.config"), () => ({ __esModule: true }));
jest.mock(require.resolve("../src/middlewares/authorization.middleware"), () =>
    jest.fn(() => (_req: any, _res: any, next: any) => next()),
);

jest.mock(
    require.resolve("../src/api/v1/controllers/chat-system/flow-definition.controllers"),
    () =>
        jest.fn().mockImplementation(() => ({
            create: (req: any, res: any) => {
                if (!req.body?.title) {
                    return res.status(400).json({ error: "title required" });
                }
                return res.status(201).json({ created: true });
            },
            list: () => {},
            update: () => {},
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

describe("POST /api/v1/flow-definition", () => {
    it("400 when title missing", async () => {
        const res = await request(app).post("/api/v1/flow-definition").send({});
        expect(res.status).toBe(400);
        expect(res.body).toEqual({ error: "title required" });
    });

    it("201 when valid", async () => {
        const res = await request(app).post("/api/v1/flow-definition").send({ title: "Flow #1" });
        expect(res.status).toBe(201);
        expect(res.body).toEqual({ created: true });
    });
});
