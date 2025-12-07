"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
jest.mock(require.resolve("../src/middlewares/requestValidator.middleware"), () => ({
    __esModule: true,
    default: jest.fn(() => (_req, _res, next) => next()),
}));
jest.mock(require.resolve("../src/middlewares/authorization.middleware"), () => jest.fn(() => (_req, _res, next) => next()));
jest.mock(require.resolve("../src/api/v1/validators/users/otp.validator"), () => ({
    __esModule: true,
    sentOTPValidator: {},
    verifyOTPValidator: {},
}));
jest.mock(require.resolve("../src/api/v1/validators/users/googleAuth.validator"), () => ({
    __esModule: true,
    default: {},
}));
jest.mock("razorpay", () => {
    return jest.fn().mockImplementation(() => ({
        orders: { create: jest.fn(), fetch: jest.fn() },
        payments: { fetch: jest.fn() },
    }));
});
// CORRECT UserController mock
jest.mock(require.resolve("../src/api/v1/controllers/users/user.controller"), () => ({
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
        sendOTPToPhone: jest.fn(),
        verifyOTP: (req, res) => {
            const { phone, otp } = req.body || {};
            if (!phone || !otp) {
                return res.status(400).json({ error: "phone and otp required" });
            }
            if (otp !== "1234") {
                return res.status(401).json({ error: "Invalid OTP" });
            }
            return res.status(200).json({ verified: true });
        },
        googleAuth: jest.fn(),
        getIsOnboarded: jest.fn(),
    })),
}));
// Firebase / Redis
jest.mock(require.resolve("../src/config/firebase"), () => ({ __esModule: true, default: null }));
jest.mock(require.resolve("../src/config/redis.config"), () => ({ __esModule: true }));
const supertest_1 = __importDefault(require("supertest"));
const app_1 = __importDefault(require("../src/app"));
describe("POST /api/v1/auth/verify-otp", () => {
    it("400 when phone or otp missing", async () => {
        const res = await (0, supertest_1.default)(app_1.default)
            .post("/api/v1/auth/verify-otp")
            .send({ phone: "+911234567890" });
        expect(res.status).toBe(400);
        expect(res.body).toEqual({ error: "phone and otp required" });
    });
    it("401 when otp invalid", async () => {
        const res = await (0, supertest_1.default)(app_1.default)
            .post("/api/v1/auth/verify-otp")
            .send({ phone: "+911234567890", otp: "0000" });
        expect(res.status).toBe(401);
        expect(res.body).toEqual({ error: "Invalid OTP" });
    });
    it("200 when valid OTP", async () => {
        const res = await (0, supertest_1.default)(app_1.default)
            .post("/api/v1/auth/verify-otp")
            .send({ phone: "+911234567890", otp: "1234" });
        expect(res.status).toBe(200);
        expect(res.body).toEqual({ verified: true });
    });
});
//# sourceMappingURL=user_verifyOtp.test.js.map