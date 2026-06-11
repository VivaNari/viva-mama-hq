"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
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
const supertest_1 = __importDefault(require("supertest"));
const app_1 = __importDefault(require("../src/app"));
describe("API Health Check", () => {
    it("should return 200 OK for /health", async () => {
        const response = await (0, supertest_1.default)(app_1.default).get("/health");
        expect(response.status).toBe(200);
        expect(response.body).toEqual({ status: "ok" });
    });
});
//# sourceMappingURL=healthCheck.test.js.map