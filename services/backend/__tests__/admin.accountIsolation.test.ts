/**
 * Automation test — staff accounts must not be reachable through patient login.
 *
 * Administrators are identified by `email`, and the app's Google sign-in upserts on
 * exactly that field. Without a guard, signing in through the mobile app with a staff
 * address would land on the administrator's own user document and mint a token
 * carrying `role: SUPER_ADMIN` — the password would be bypassable entirely.
 *
 * Run:  npx jest admin.accountIsolation
 */
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

jest.mock(require.resolve("../src/config/firebase"), () => ({ __esModule: true, default: null }));
jest.mock(require.resolve("../src/config/redis.config"), () => ({
    __esModule: true,
    redisPublisher: null,
    redisSubscriber: null,
}));
jest.mock("razorpay", () =>
    jest.fn().mockImplementation(() => ({
        orders: { create: jest.fn(), fetch: jest.fn() },
        payments: { fetch: jest.fn() },
    })),
);

const ADMIN_EMAIL = "ops@vivamama.app";

// Stand in for Google: whatever idToken arrives, report it belongs to ADMIN_EMAIL.
jest.mock("google-auth-library", () => ({
    OAuth2Client: jest.fn().mockImplementation(() => ({
        verifyIdToken: jest.fn().mockResolvedValue({
            getPayload: () => ({
                name: "Someone",
                email: ADMIN_EMAIL,
                picture: "https://example.com/a.png",
            }),
        }),
    })),
}));

import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import request from "supertest";
import app from "../src/app";
import userModel from "../src/models/user.model";
import { EUserRole } from "../src/types";
import { connectTestDb, closeTestDb, clearTestDb } from "./helpers/db";

describe("staff account isolation", () => {
    beforeAll(async () => {
        await connectTestDb();
    });

    afterAll(async () => {
        await closeTestDb();
    });

    afterEach(async () => {
        await clearTestDb();
    });

    const seedAdmin = async () =>
        userModel.create({
            email: ADMIN_EMAIL,
            password: await bcrypt.hash("correct-horse-battery", 10),
            role: EUserRole.SUPER_ADMIN,
        });

    it("does not hand out an admin token to a Google sign-in on the staff address", async () => {
        const admin = await seedAdmin();

        const res = await request(app)
            .post("/api/v1/auth/google")
            .send({ idToken: "any-token-the-mock-accepts" });

        expect(res.status).toBe(200);

        const decoded = jwt.decode(res.body.token) as any;
        expect(decoded.role).not.toBe(EUserRole.SUPER_ADMIN);
        expect(decoded._id).not.toBe(admin._id.toString());
    });

    it("leaves the administrator's own document untouched", async () => {
        const admin = await seedAdmin();

        await request(app).post("/api/v1/auth/google").send({ idToken: "any" });

        const reloaded = await userModel.findById(admin._id).select("+password");
        expect(reloaded?.role).toBe(EUserRole.SUPER_ADMIN);
        expect(reloaded?.password).toBeTruthy();
        // The patient's Google profile must not have been written over the staff row.
        expect(reloaded?.profile_picture).toBeNull();
    });

    it("the resulting patient token cannot reach an admin route", async () => {
        await seedAdmin();

        const res = await request(app).post("/api/v1/auth/google").send({ idToken: "any" });

        const guarded = await request(app)
            .get("/api/v1/admin/consultations")
            .set("Authorization", `Bearer ${res.body.token}`);

        expect(guarded.status).toBe(403);
    });

    it("still lets an ordinary Google user sign in normally", async () => {
        // No admin seeded at all — the common case must be unaffected.
        const res = await request(app).post("/api/v1/auth/google").send({ idToken: "any" });

        expect(res.status).toBe(200);
        expect(res.body.token).toEqual(expect.any(String));

        const created = await userModel.findOne({ email: ADMIN_EMAIL });
        expect(created?.role).toBe(EUserRole.USER);
    });
});
