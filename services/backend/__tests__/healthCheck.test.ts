// Mock services before importing app
jest.mock("../src/config/firebase", () => ({
    __esModule: true,
    default: null,
}));

jest.mock("../src/config/redis.config", () => ({
    __esModule: true,
    default: null,
}));

jest.mock("razorpay", () => {
    return jest.fn().mockImplementation(() => ({
        orders: { create: jest.fn(), fetch: jest.fn() },
        payments: { fetch: jest.fn() },
    }));
});

import request from "supertest";
import app from "../src/app";

describe("API Health Check", () => {
    it("should return 200 OK for /health", async () => {
        const response = await request(app).get("/health");
        expect(response.status).toBe(200);
        expect(response.body).toEqual({ status: "ok" });
    });
});
