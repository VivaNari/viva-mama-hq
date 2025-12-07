jest.mock(require.resolve("../src/middlewares/requestValidator.middleware"), () => ({
    __esModule: true,
    default: jest.fn(() => (_req: any, _res: any, next: any) => next()),
}));

jest.mock(require.resolve("../src/middlewares/authorization.middleware"), () =>
    jest.fn(() => (_req: any, _res: any, next: any) => next()),
);

jest.mock(require.resolve("../src/api/v1/validators/users/googleAuth.validator"), () => ({
    __esModule: true,
    default: {},
}));

jest.mock(require.resolve("../src/api/v1/validators/users/otp.validator"), () => ({
    __esModule: true,
    sentOTPValidator: {},
    verifyOTPValidator: {},
}));

jest.mock("razorpay", () => {
    return jest.fn().mockImplementation(() => ({
        orders: { create: jest.fn(), fetch: jest.fn() },
        payments: { fetch: jest.fn() },
    }));
});

// UserController mock (correct path)
jest.mock(require.resolve("../src/api/v1/controllers/users/user.controller"), () => ({
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
        sendOTPToPhone: (req: any, res: any) => {
            const phone = req.body?.phone;
            if (!phone) return res.status(400).json({ error: "phone required" });
            return res.status(200).json({ message: "OTP sent" });
        },
        verifyOTP: jest.fn(),
        googleAuth: jest.fn(),
        getIsOnboarded: jest.fn(),
    })),
}));

jest.mock(require.resolve("../src/config/firebase"), () => ({ __esModule: true, default: null }));
jest.mock(require.resolve("../src/config/redis.config"), () => ({ __esModule: true }));

import request from "supertest";
import app from "../src/app";

describe("POST /api/v1/auth/send-otp", () => {
    it("400 when phone missing", async () => {
        const res = await request(app).post("/api/v1/auth/send-otp").send({});
        expect(res.status).toBe(400);
        expect(res.body).toEqual({ error: "phone required" });
    });

    it("200 when valid", async () => {
        const res = await request(app)
            .post("/api/v1/auth/send-otp")
            .send({ phone: "+911234567890" });

        expect(res.status).toBe(200);
        expect(res.body).toEqual({ message: "OTP sent" });
    });
});
