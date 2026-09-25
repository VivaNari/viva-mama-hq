/**
 * Automation test — super-admin surface (/api/v1/admin/*).
 *
 * Runs against a real in-memory MongoDB rather than mocked models, because the things
 * worth proving here are database-level: the partial unique index on admin `email`, the
 * `select: false` on `password`, and — above all — that an ordinary patient's token,
 * which is signed with the very same secret, cannot reach an admin route.
 *
 * Real bcrypt, real jwt, real middleware, real service. Only the heavy side-effect
 * modules are mocked, per repo convention.
 *
 * Run:  npx jest admin.consultations
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
// The confirm-time push is best-effort in production; here it just must not fire.
jest.mock(require.resolve("../src/utils/sendPushNotification"), () => ({
    __esModule: true,
    sendPushNotification: jest.fn().mockResolvedValue(undefined),
}));

import request from "supertest";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import app from "../src/app";
import userModel from "../src/models/user.model";
import consultationModel from "../src/models/consultation.model";
import { EUserRole } from "../src/types";
import { ConsultationTypeEnum, CallbackRequestStatusEnum } from "../src/types/consultation.types";
import { EPreferredSlot } from "../src/constants/consultation-slots";
import { generateJWT } from "../src/utils/functions/generateJWT";
import { connectTestDb, closeTestDb, clearTestDb } from "./helpers/db";

const ADMIN_EMAIL = "coordinator@vivamama.app";
const ADMIN_PASSWORD = "correct-horse-battery";

describe("admin surface", () => {
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
            password: await bcrypt.hash(ADMIN_PASSWORD, 10),
            role: EUserRole.SUPER_ADMIN,
        });

    const seedPatient = async () =>
        userModel.create({ mobile_number: "9990001111", role: EUserRole.USER });

    const login = async () => {
        const res = await request(app)
            .post("/api/v1/admin/auth/login")
            .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
        return res.body.data.token as string;
    };

    describe("POST /api/v1/admin/auth/login", () => {
        it("issues a token carrying the SUPER_ADMIN role", async () => {
            await seedAdmin();

            const res = await request(app)
                .post("/api/v1/admin/auth/login")
                .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.admin.role).toBe(EUserRole.SUPER_ADMIN);
            expect(res.body.data.token).toEqual(expect.any(String));
        });

        it("accepts the email case-insensitively", async () => {
            await seedAdmin();

            const res = await request(app)
                .post("/api/v1/admin/auth/login")
                .send({ email: ADMIN_EMAIL.toUpperCase(), password: ADMIN_PASSWORD });

            expect(res.status).toBe(200);
        });

        it("never returns the password hash", async () => {
            await seedAdmin();
            const res = await request(app)
                .post("/api/v1/admin/auth/login")
                .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD });

            expect(JSON.stringify(res.body)).not.toContain("$2b$");
        });

        it("gives the same answer for a wrong password and an unknown user", async () => {
            await seedAdmin();

            const wrongPassword = await request(app)
                .post("/api/v1/admin/auth/login")
                .send({ email: ADMIN_EMAIL, password: "not-the-password" });
            const unknownUser = await request(app)
                .post("/api/v1/admin/auth/login")
                .send({ email: "nobody@vivamama.app", password: "not-the-password" });

            expect(wrongPassword.status).toBe(401);
            expect(unknownUser.status).toBe(401);
            // Identical text — otherwise staff accounts could be enumerated.
            expect(wrongPassword.body.message).toBe(unknownUser.body.message);
        });

        it("refuses a patient account that shares the address", async () => {
            // Same credentials, but role USER: the login query filters on SUPER_ADMIN.
            await userModel.create({
                email: ADMIN_EMAIL,
                password: await bcrypt.hash(ADMIN_PASSWORD, 10),
                role: EUserRole.USER,
            });

            const res = await request(app)
                .post("/api/v1/admin/auth/login")
                .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD });

            expect(res.status).toBe(401);
        });
    });

    describe("guard on /api/v1/admin/consultations", () => {
        it("rejects an anonymous request", async () => {
            const res = await request(app).get("/api/v1/admin/consultations");
            expect(res.status).toBe(401);
        });

        it("rejects an ordinary patient's token", async () => {
            const patient = await seedPatient();
            // A genuine, unexpired, correctly-signed mobile-app token.
            const patientToken = generateJWT(patient.toObject() as any);

            const res = await request(app)
                .get("/api/v1/admin/consultations")
                .set("Authorization", `Bearer ${patientToken}`);

            expect(res.status).toBe(403);
        });

        it("rejects a token whose role claim was forged after the account was demoted", async () => {
            const admin = await seedAdmin();
            const token = generateJWT(admin.toObject() as any);

            // Demote in the database. The token still says SUPER_ADMIN and is still
            // validly signed — only the second, database-level check catches this.
            await userModel.findByIdAndUpdate(admin._id, { role: EUserRole.USER });

            const res = await request(app)
                .get("/api/v1/admin/consultations")
                .set("Authorization", `Bearer ${token}`);

            expect(res.status).toBe(403);
        });
    });

    describe("GET /api/v1/admin/consultations", () => {
        const seedConsultation = async (userId: mongoose.Types.ObjectId, overrides = {}) =>
            consultationModel.create({
                userId,
                consultationType: ConsultationTypeEnum.EXPERT,
                consultatorId: new mongoose.Types.ObjectId(),
                requestStatus: CallbackRequestStatusEnum.PENDING,
                preferred_consultation_date: new Date("2030-01-15T00:00:00.000Z"),
                preferred_slot: EPreferredSlot.MORNING,
                ...overrides,
            });

        it("paginates and reports the unfiltered total", async () => {
            await seedAdmin();
            const patient = await seedPatient();
            await Promise.all([
                seedConsultation(patient._id as mongoose.Types.ObjectId),
                seedConsultation(patient._id as mongoose.Types.ObjectId),
                seedConsultation(patient._id as mongoose.Types.ObjectId),
            ]);
            const token = await login();

            const res = await request(app)
                .get("/api/v1/admin/consultations?page=1&limit=2")
                .set("Authorization", `Bearer ${token}`);

            expect(res.status).toBe(200);
            expect(res.body.data.items).toHaveLength(2);
            expect(res.body.data.total).toBe(3);
            expect(res.body.data.page).toBe(1);
        });

        it("filters by status and by consultation type", async () => {
            await seedAdmin();
            const patient = await seedPatient();
            await seedConsultation(patient._id as mongoose.Types.ObjectId, {
                requestStatus: CallbackRequestStatusEnum.COMPLETED,
            });
            await seedConsultation(patient._id as mongoose.Types.ObjectId, {
                consultationType: ConsultationTypeEnum.CARE_MANAGER,
            });
            const token = await login();

            const completed = await request(app)
                .get(`/api/v1/admin/consultations?status=${CallbackRequestStatusEnum.COMPLETED}`)
                .set("Authorization", `Bearer ${token}`);
            const careManager = await request(app)
                .get(
                    `/api/v1/admin/consultations?consultationType=${ConsultationTypeEnum.CARE_MANAGER}`,
                )
                .set("Authorization", `Bearer ${token}`);

            expect(completed.body.data.total).toBe(1);
            expect(careManager.body.data.total).toBe(1);
        });

        it("resolves a search term against the patient's mobile number", async () => {
            await seedAdmin();
            const wanted = await seedPatient();
            const other = await userModel.create({ mobile_number: "8887776666" });
            await seedConsultation(wanted._id as mongoose.Types.ObjectId);
            await seedConsultation(other._id as mongoose.Types.ObjectId);
            const token = await login();

            const res = await request(app)
                .get("/api/v1/admin/consultations?search=9990001111")
                .set("Authorization", `Bearer ${token}`);

            expect(res.body.data.total).toBe(1);
        });

        it("attaches the slot label and never leaks a password hash", async () => {
            await seedAdmin();
            const patient = await seedPatient();
            await seedConsultation(patient._id as mongoose.Types.ObjectId);
            const token = await login();

            const res = await request(app)
                .get("/api/v1/admin/consultations")
                .set("Authorization", `Bearer ${token}`);

            expect(res.body.data.items[0].preferred_slot_label).toBe("9:00 AM – 11:59 AM");
            expect(JSON.stringify(res.body)).not.toContain("$2b$");
        });
    });

    describe("PATCH /api/v1/admin/consultations/:id/confirm-time", () => {
        const seedMorningConsultation = async (userId: mongoose.Types.ObjectId) =>
            consultationModel.create({
                userId,
                consultationType: ConsultationTypeEnum.EXPERT,
                consultatorId: new mongoose.Types.ObjectId(),
                requestStatus: CallbackRequestStatusEnum.PENDING,
                // 2030-01-15 IST.
                preferred_consultation_date: new Date("2030-01-14T18:30:00.000Z"),
                preferred_slot: EPreferredSlot.MORNING,
            });

        it("writes meeting_confirmed_at for a time inside the booked slot", async () => {
            await seedAdmin();
            const patient = await seedPatient();
            const consultation = await seedMorningConsultation(
                patient._id as mongoose.Types.ObjectId,
            );
            const token = await login();

            // 10:30 IST on the booked day — inside MORNING (09:00–11:59 IST).
            const confirmedAt = "2030-01-15T05:00:00.000Z";

            const res = await request(app)
                .patch(`/api/v1/admin/consultations/${consultation._id}/confirm-time`)
                .set("Authorization", `Bearer ${token}`)
                .send({ confirmedAt });

            expect(res.status).toBe(200);
            const reloaded = await consultationModel.findById(consultation._id);
            expect(reloaded?.meeting_confirmed_at?.toISOString()).toBe(confirmedAt);
        });

        // 16:00 IST — EVENING, not the MORNING the patient requested.
        const OUTSIDE_SLOT_AT = "2030-01-15T10:30:00.000Z";

        it("holds a time outside the requested slot until the caller acknowledges it", async () => {
            await seedAdmin();
            const patient = await seedPatient();
            const consultation = await seedMorningConsultation(
                patient._id as mongoose.Types.ObjectId,
            );
            const token = await login();

            const res = await request(app)
                .patch(`/api/v1/admin/consultations/${consultation._id}/confirm-time`)
                .set("Authorization", `Bearer ${token}`)
                .send({ confirmedAt: OUTSIDE_SLOT_AT });

            // 409, not 400 — the time is allowed, it just has not been confirmed twice
            // yet, and the panel has to tell that apart from a real rejection.
            expect(res.status).toBe(409);
            expect(res.body.data.requires_confirmation).toBe(true);
            expect(res.body.data.preferred_slot_label).toBe("9:00 AM – 11:59 AM");

            // The whole point of asking before writing: a mistyped time never reaches
            // the patient, because nothing was saved and no push went out.
            const reloaded = await consultationModel.findById(consultation._id);
            expect(reloaded?.meeting_confirmed_at).toBeNull();
        });

        it("writes a time outside the requested slot once acknowledged", async () => {
            await seedAdmin();
            const patient = await seedPatient();
            const consultation = await seedMorningConsultation(
                patient._id as mongoose.Types.ObjectId,
            );
            const token = await login();

            const res = await request(app)
                .patch(`/api/v1/admin/consultations/${consultation._id}/confirm-time`)
                .set("Authorization", `Bearer ${token}`)
                .send({ confirmedAt: OUTSIDE_SLOT_AT, acknowledgeOutsideSlot: true });

            expect(res.status).toBe(200);
            expect(res.body.data.outside_preferred_slot).toBe(true);

            const reloaded = await consultationModel.findById(consultation._id);
            expect(reloaded?.meeting_confirmed_at?.toISOString()).toBe(OUTSIDE_SLOT_AT);
        });

        it("answers 404 for a consultation that does not exist", async () => {
            await seedAdmin();
            const token = await login();

            const res = await request(app)
                .patch(`/api/v1/admin/consultations/${new mongoose.Types.ObjectId()}/confirm-time`)
                .set("Authorization", `Bearer ${token}`)
                .send({ confirmedAt: "2030-01-15T05:00:00.000Z" });

            expect(res.status).toBe(404);
        });

        it("rejects a non-ISO confirmedAt at the validator", async () => {
            await seedAdmin();
            const patient = await seedPatient();
            const consultation = await seedMorningConsultation(
                patient._id as mongoose.Types.ObjectId,
            );
            const token = await login();

            const res = await request(app)
                .patch(`/api/v1/admin/consultations/${consultation._id}/confirm-time`)
                .set("Authorization", `Bearer ${token}`)
                .send({ confirmedAt: "not-a-date" });

            expect(res.status).toBe(400);
        });
    });

    describe("status transitions", () => {
        const seedConsultation = async (userId: mongoose.Types.ObjectId) =>
            consultationModel.create({
                userId,
                consultationType: ConsultationTypeEnum.EXPERT,
                consultatorId: new mongoose.Types.ObjectId(),
                requestStatus: CallbackRequestStatusEnum.PENDING,
                preferred_consultation_date: new Date("2030-01-15T00:00:00.000Z"),
                preferred_slot: EPreferredSlot.MORNING,
            });

        it("marks a consultation completed without needing the patient's own token", async () => {
            await seedAdmin();
            const patient = await seedPatient();
            const consultation = await seedConsultation(patient._id as mongoose.Types.ObjectId);
            const token = await login();

            const res = await request(app)
                .put(`/api/v1/admin/consultations/${consultation._id}/completed`)
                .set("Authorization", `Bearer ${token}`);

            expect(res.status).toBe(200);
            const reloaded = await consultationModel.findById(consultation._id);
            expect(reloaded?.requestStatus).toBe(CallbackRequestStatusEnum.COMPLETED);
        });

        it("marks a consultation unhandled", async () => {
            await seedAdmin();
            const patient = await seedPatient();
            const consultation = await seedConsultation(patient._id as mongoose.Types.ObjectId);
            const token = await login();

            const res = await request(app)
                .put(`/api/v1/admin/consultations/${consultation._id}/unhandled`)
                .set("Authorization", `Bearer ${token}`);

            expect(res.status).toBe(200);
            const reloaded = await consultationModel.findById(consultation._id);
            expect(reloaded?.requestStatus).toBe(CallbackRequestStatusEnum.UNHANDLED);
        });
    });

    describe("users collection", () => {
        it("lets any number of OTP patients coexist with a null email", async () => {
            // The regression that matters for existing users: `email` defaults to an
            // explicit null and every phone signup sits on it, so the admin uniqueness
            // index must never apply to them. A plain unique index would reject the
            // second signup outright.
            await userModel.create({ mobile_number: "1111111111" });
            await userModel.create({ mobile_number: "2222222222" });
            await expect(userModel.create({ mobile_number: "3333333333" })).resolves.toBeDefined();
        });

        it("lets a patient keep an address an administrator also uses", async () => {
            await seedAdmin();
            await expect(
                userModel.create({ email: ADMIN_EMAIL, mobile_number: "4444444444" }),
            ).resolves.toBeDefined();
        });

        it("refuses two administrators on the same email", async () => {
            await seedAdmin();
            await expect(seedAdmin()).rejects.toThrow();
        });

        it("keeps the password hash out of an ordinary read", async () => {
            const admin = await seedAdmin();
            const reloaded = await userModel.findById(admin._id);
            expect(reloaded?.password).toBeUndefined();
        });
    });

    describe("retired routes", () => {
        it("no longer serves the user-guarded confirm-time endpoint", async () => {
            const res = await request(app)
                .patch("/api/v1/admin/consultation/123/confirm-time")
                .send({ confirmedAt: new Date().toISOString() });

            expect(res.status).toBe(404);
        });
    });

    describe("route mounting", () => {
        // The admin router is mounted at /api/v1/admin ahead of the aggregator, and the
        // aggregator still owns several unrelated /admin/* paths. Express must fall
        // through to them rather than the new mount swallowing the prefix. A 404 here
        // would mean the content/product/expert admin tooling had gone dark.
        it.each([
            ["post", "/api/v1/admin/experts"],
            ["post", "/api/v1/admin/care-managers"],
            ["post", "/api/v1/admin/contents"],
            ["post", "/api/v1/admin/products"],
            ["post", "/api/v1/admin/recommendations"],
            ["post", "/api/v1/admin/migrate/run-all"],
        ])("still routes %s %s", async (method, path) => {
            const res = await (request(app) as any)[method](path).send({});
            expect(res.status).not.toBe(404);
        });

        it("leaves the patient-facing consultation routes in place", async () => {
            // Guarded by the ordinary user middleware, so an anonymous call is a 401.
            // A 404 would mean the mobile app had lost its booking endpoints.
            for (const path of [
                "/api/v1/callback-request",
                "/api/v1/consultations/book-with-credit",
            ]) {
                const res = await request(app).post(path).send({});
                expect(res.status).not.toBe(404);
            }

            const pending = await request(app).get("/api/v1/pending-consultations");
            expect(pending.status).not.toBe(404);
        });
    });
});
