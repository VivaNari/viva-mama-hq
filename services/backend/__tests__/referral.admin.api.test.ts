/**
 * The referral admin surface.
 *
 * Two things are worth a test here rather than a read-through: that every route really
 * is behind SUPER_ADMIN (a patient's token is signed with the same secret, so "it has a
 * /admin prefix" proves nothing — POST /admin/experts sat behind plain authMiddleware
 * for exactly that reason), and that the two fields a PATCH must never touch are
 * actually refused.
 *
 * Run:  npx jest referral.admin.api
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

import jwt from "jsonwebtoken";
import request from "supertest";
import app from "../src/app";
import { connectTestDb, closeTestDb, clearTestDb } from "./helpers/db";
import UserModel from "../src/models/user.model";
import expertModel from "../src/models/expert.model";
import expertCategoryModel from "../src/models/expert-category.model";
import organizationModel from "../src/models/organization.model";
import referralProgramModel from "../src/models/referral-program.model";
import { EUserRole } from "../src/types/user.types";
import { EExpertCategory } from "../src/types/expert.types";
import { EReferralOwnerType } from "../src/types/referral.types";
import { EPlanCode } from "../src/types/subscription.types";
import { ECapability, EAccess } from "../src/services/entitlements/entitlement.config";

jest.setTimeout(120000);

const sign = (id: string, role: EUserRole) =>
    jwt.sign({ _id: id, role }, process.env.JWT_SECRET as string, { expiresIn: "1h" });

async function makeAdmin() {
    const admin = await UserModel.create({
        email: "ops@vivamama.app",
        role: EUserRole.SUPER_ADMIN,
    });
    return sign(String(admin._id), EUserRole.SUPER_ADMIN);
}

/** A real USER-role row: adminAuthMiddleware re-reads the role from Mongo. */
async function makePatientToken() {
    const user = await UserModel.create({ mobile_number: "9000000009" });
    return sign(String(user._id), EUserRole.USER);
}

async function makeExpert() {
    const category = await expertCategoryModel.create({
        key: EExpertCategory.GYNECOLOGIST,
        name: "Gynecologist",
        description: "d",
        coveredAreas: [],
        isActive: true,
    });
    return expertModel.create({
        name: "Dr Sujana Roy",
        speciality: "Gynecology",
        category: category._id,
        yearsOfExperience: 10,
        photograph: "img",
        remuneration: 500,
        isActive: true,
    });
}

beforeAll(connectTestDb);
afterAll(closeTestDb);
beforeEach(clearTestDb);

describe("authorization", () => {
    const routes: Array<[string, string]> = [
        ["post", "/api/v1/admin/organizations"],
        ["get", "/api/v1/admin/organizations"],
        ["post", "/api/v1/admin/referral-programs"],
        ["get", "/api/v1/admin/referral-programs"],
        ["get", "/api/v1/admin/referral-redemptions"],
    ];

    it.each(routes)("refuses a patient token on %s %s", async (method, path) => {
        const token = await makePatientToken();
        const res = await (request(app) as any)
            [method](path)
            .set("Authorization", `Bearer ${token}`)
            .send({});
        expect(res.status).toBe(403);
    });

    it.each(routes)("refuses an anonymous caller on %s %s", async (method, path) => {
        const res = await (request(app) as any)[method](path).send({});
        expect([401, 403]).toContain(res.status);
    });
});

describe("programs", () => {
    it("creates an expert-owned program", async () => {
        const token = await makeAdmin();
        const expert = await makeExpert();

        const res = await request(app)
            .post("/api/v1/admin/referral-programs")
            .set("Authorization", `Bearer ${token}`)
            .send({
                code: "DRSUJANA12026",
                ownerType: EReferralOwnerType.EXPERT,
                expertId: String(expert._id),
                grant: { planCode: EPlanCode.MONTHLY },
                seats: { total: 500 },
                entitlementOverrides: [
                    { capability: ECapability.PRODUCTS_VIEW, access: EAccess.LOCKED },
                ],
            });

        expect(res.status).toBe(201);
        expect(res.body.data.code).toBe("DRSUJANA12026");
        expect(res.body.data.benefits.seats.claimed).toBe(0);
    });

    it("rejects a duplicate code with 409, not a 500", async () => {
        const token = await makeAdmin();
        const expert = await makeExpert();
        const body = {
            code: "DUPE12026",
            ownerType: EReferralOwnerType.EXPERT,
            expertId: String(expert._id),
        };

        await request(app)
            .post("/api/v1/admin/referral-programs")
            .set("Authorization", `Bearer ${token}`)
            .send(body);

        const res = await request(app)
            .post("/api/v1/admin/referral-programs")
            .set("Authorization", `Bearer ${token}`)
            .send(body);

        expect(res.status).toBe(409);
        expect(res.body.data.code).toBe("REFERRAL_CODE_TAKEN");
    });

    it("rejects an owner that does not exist — Joi cannot check this", async () => {
        const token = await makeAdmin();
        const res = await request(app)
            .post("/api/v1/admin/referral-programs")
            .set("Authorization", `Bearer ${token}`)
            .send({
                code: "GHOST12026",
                ownerType: EReferralOwnerType.EXPERT,
                expertId: "0123456789abcdef01234567",
            });

        expect(res.status).toBe(404);
    });

    it("rejects an ALLOWED override, which would silently do nothing", async () => {
        const token = await makeAdmin();
        const expert = await makeExpert();

        const res = await request(app)
            .post("/api/v1/admin/referral-programs")
            .set("Authorization", `Bearer ${token}`)
            .send({
                code: "WIDEN12026",
                ownerType: EReferralOwnerType.EXPERT,
                expertId: String(expert._id),
                entitlementOverrides: [
                    { capability: ECapability.PRODUCTS_VIEW, access: EAccess.ALLOWED },
                ],
            });

        expect(res.status).toBe(400);
    });

    it("refuses to PATCH the seat counter or the code", async () => {
        const token = await makeAdmin();
        const expert = await makeExpert();
        const program = await referralProgramModel.create({
            code: "PATCH12026",
            ownerType: EReferralOwnerType.EXPERT,
            owner_expert_id: expert._id,
            benefits: {
                grant: { planCode: null },
                seats: { total: 10, claimed: 3 },
                entitlementOverrides: [],
            },
        });

        for (const body of [
            { "benefits.seats.claimed": 0 },
            { "benefits.seats.total": 999 },
            { code: "SOMETHINGELSE" },
        ]) {
            const res = await request(app)
                .patch(`/api/v1/admin/referral-programs/${program._id}`)
                .set("Authorization", `Bearer ${token}`)
                .send(body);
            expect(res.status).toBe(400);
        }

        const unchanged = await referralProgramModel.findById(program._id).lean();
        expect(unchanged!.benefits.seats.claimed).toBe(3);
        expect(unchanged!.benefits.seats.total).toBe(10);
        expect(unchanged!.code).toBe("PATCH12026");
    });

    /** Additive, because two admins setting an absolute value would lose one write. */
    it("tops seats up through the dedicated endpoint", async () => {
        const token = await makeAdmin();
        const expert = await makeExpert();
        const program = await referralProgramModel.create({
            code: "SEATS12026",
            ownerType: EReferralOwnerType.EXPERT,
            owner_expert_id: expert._id,
            benefits: {
                grant: { planCode: EPlanCode.MONTHLY },
                seats: { total: 100, claimed: 40 },
                entitlementOverrides: [],
            },
        });

        const res = await request(app)
            .post(`/api/v1/admin/referral-programs/${program._id}/seats`)
            .set("Authorization", `Bearer ${token}`)
            .send({ addSeats: 250 });

        expect(res.status).toBe(200);
        const after = await referralProgramModel.findById(program._id).lean();
        expect(after!.benefits.seats.total).toBe(350);
        // The claim counter is untouched by a top-up.
        expect(after!.benefits.seats.claimed).toBe(40);
    });

    it("returns 400 for a malformed id rather than a 500", async () => {
        const token = await makeAdmin();
        const res = await request(app)
            .get("/api/v1/admin/referral-programs/not-an-object-id")
            .set("Authorization", `Bearer ${token}`);
        expect(res.status).toBe(400);
    });
});

describe("organizations", () => {
    it("derives a slug from the name and rejects a duplicate", async () => {
        const token = await makeAdmin();

        const created = await request(app)
            .post("/api/v1/admin/organizations")
            .set("Authorization", `Bearer ${token}`)
            .send({ name: "Acme Health Pvt Ltd" });

        expect(created.status).toBe(201);
        expect(created.body.data.slug).toBe("acme-health-pvt-ltd");

        const dupe = await request(app)
            .post("/api/v1/admin/organizations")
            .set("Authorization", `Bearer ${token}`)
            .send({ name: "Acme Health Pvt Ltd" });

        expect(dupe.status).toBe(409);
        expect(await organizationModel.countDocuments({})).toBe(1);
    });
});
