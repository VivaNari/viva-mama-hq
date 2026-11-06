/**
 * The mother log routes end to end through the real Express app: auth, the body
 * validators, route order ("daily" and "anc-schedule" must never be read as an id), and
 * the profile fields the log screens read (height for BMI, care model for the route).
 *
 * motherLogs.test.ts covers the rules at the controller; this file covers the wiring.
 *
 * Run:  npx jest motherLogs.http
 */

jest.mock(require.resolve("../src/config/firebase"), () => ({ __esModule: true, default: null }));
jest.mock(require.resolve("../src/config/redis.config"), () => ({ __esModule: true }));
jest.mock("razorpay", () =>
    jest.fn().mockImplementation(() => ({ orders: { create: jest.fn() } })),
);

import jwt from "jsonwebtoken";
import request from "supertest";

import { clearTestDb, closeTestDb, connectTestDb } from "./helpers/db";
import app from "../src/app";
import env from "../src/config/env";
import UserModel from "../src/models/user.model";
import { EUserCategory } from "../src/types/user.types";

jest.setTimeout(120000);

const API = "/api/v1";

async function signedInMother() {
    const user = await UserModel.create({
        mobile_number: `9${Math.floor(100000000 + Math.random() * 899999999)}`,
        user_category: EUserCategory.PP,
    });
    const token = jwt.sign({ _id: user._id.toString() }, env.JWT_SECRET as string);
    return { userId: user._id.toString(), auth: `Bearer ${token}` };
}

beforeAll(connectTestDb);
afterAll(closeTestDb);
beforeEach(clearTestDb);

describe("mother log routes", () => {
    it("refuses a request without a token", async () => {
        const res = await request(app).get(`${API}/mother-logs`);
        expect(res.status).toBe(401);
    });

    it("saves and lists an entry", async () => {
        const { auth } = await signedInMother();

        const created = await request(app)
            .post(`${API}/mother-logs`)
            .set("Authorization", auth)
            .send({ logType: "pumping", fields: { side: "left", minutes: 12, ml: 50 } });
        expect(created.status).toBe(200);

        const listed = await request(app)
            .get(`${API}/mother-logs?types=pumping`)
            .set("Authorization", auth);
        expect(listed.status).toBe(200);
        expect(listed.body.data).toHaveLength(1);
        expect(listed.body.data[0].fields.ml).toBe(50);
    });

    it("rejects a malformed body at the validator", async () => {
        const { auth } = await signedInMother();
        const res = await request(app)
            .post(`${API}/mother-logs`)
            .set("Authorization", auth)
            .send({ logType: "bp", fields: { systolic: "high" } });
        expect(res.status).toBe(400);
    });

    it("routes the daily counter and ANC schedule paths, not /:id", async () => {
        const { auth } = await signedInMother();

        const daily = await request(app)
            .put(`${API}/mother-logs/daily`)
            .set("Authorization", auth)
            .send({ logType: "water", fields: { glasses: 4 } });
        expect(daily.status).toBe(200);
        expect(daily.body.data.fields.glasses).toBe(4);

        const tick = await request(app)
            .put(`${API}/mother-logs/anc-schedule/g2b`)
            .set("Authorization", auth)
            .send({ done: true });
        expect(tick.status).toBe(200);

        const schedule = await request(app)
            .get(`${API}/mother-logs/anc-schedule`)
            .set("Authorization", auth);
        expect(schedule.body.data.doneItemIds).toEqual(["g2b"]);
    });

    it("routes the PNC schedule paths, not /:id", async () => {
        const { auth } = await signedInMother();

        const tick = await request(app)
            .put(`${API}/mother-logs/pnc-schedule/m3a`)
            .set("Authorization", auth)
            .send({ done: true });
        expect(tick.status).toBe(200);

        const schedule = await request(app)
            .get(`${API}/mother-logs/pnc-schedule`)
            .set("Authorization", auth);
        expect(schedule.body.data.doneItemIds).toEqual(["m3a"]);
    });

    it("removes an entry by id", async () => {
        const { auth } = await signedInMother();
        const created = await request(app)
            .post(`${API}/mother-logs`)
            .set("Authorization", auth)
            .send({ logType: "hb", fields: { value: 10.9 } });

        const removed = await request(app)
            .delete(`${API}/mother-logs/${created.body.data._id}`)
            .set("Authorization", auth);
        expect(removed.status).toBe(200);

        const bad = await request(app).delete(`${API}/mother-logs/not-an-id`).set("Authorization", auth);
        expect(bad.status).toBe(400);
    });

    it("adds a medicine and marks it taken", async () => {
        const { auth } = await signedInMother();
        const added = await request(app)
            .post(`${API}/mother-medicines`)
            .set("Authorization", auth)
            .send({ presetKey: "calcium", frequency: "twice_a_day" });
        expect(added.status).toBe(200);
        const id = added.body.data.medicines[0]._id;

        const taken = await request(app)
            .put(`${API}/mother-medicines/${id}/taken`)
            .set("Authorization", auth)
            .send({ taken: true });
        expect(taken.status).toBe(200);
        expect(taken.body.data.medicines[0].takenToday).toBe(true);
    });
});

describe("the Journey delivery buttons", () => {
    const makeMother = async (fields: object) => {
        const { userId, auth } = await signedInMother();
        await UserModel.updateOne({ _id: userId }, { $set: fields });
        return { userId, auth };
    };
    const arrived = (auth: string, delivery_date: string) =>
        request(app)
            .post(`${API}/user/baby-arrived`)
            .set("Authorization", auth)
            .send({ delivery_date, delivery_type: "vaginal", delivery_outcome: "live_birth" });
    const daysAgo = (days: number) =>
        new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);

    it("records labour for a pregnant woman", async () => {
        const { userId, auth } = await makeMother({ user_category: EUserCategory.NP });
        const res = await request(app).post(`${API}/user/labour-started`).set("Authorization", auth);
        expect(res.status).toBe(200);
        const user = await UserModel.findById(userId).lean();
        expect(user?.onboarding_data?.labour_started_at).toBeTruthy();
    });

    it("refuses labour once the birth is confirmed", async () => {
        const { auth } = await makeMother({ user_category: EUserCategory.PP });
        const res = await request(app).post(`${API}/user/labour-started`).set("Authorization", auth);
        expect(res.status).toBe(409);
    });

    it("moves a pregnant woman to postpartum on the real date", async () => {
        const { userId, auth } = await makeMother({ user_category: EUserCategory.NP });
        expect((await arrived(auth, daysAgo(1))).status).toBe(200);

        const user = await UserModel.findById(userId).lean();
        expect(user?.user_category).toBe(EUserCategory.PP);
        expect(user?.onboarding_data?.delivery_date?.toISOString().slice(0, 10)).toBe(daysAgo(1));
        expect(user?.onboarding_data?.delivery_type).toBe("vaginal");
        expect(user?.current_weekdays?.weeks).toBe(1);
    });

    it("lets her correct a date the due-date job only estimated, then locks it", async () => {
        const { userId, auth } = await makeMother({
            user_category: EUserCategory.PP,
            "onboarding_data.delivery_date": new Date(daysAgo(5)),
            "onboarding_data.delivery_date_estimated": true,
        });

        expect((await arrived(auth, daysAgo(0))).status).toBe(200);
        const user = await UserModel.findById(userId).lean();
        expect(user?.onboarding_data?.delivery_date_estimated).toBe(false);
        expect(user?.onboarding_data?.delivery_date?.toISOString().slice(0, 10)).toBe(daysAgo(0));

        expect((await arrived(auth, daysAgo(1))).status).toBe(403);
    });

    it("stays locked for a postpartum user with no estimated flag", async () => {
        const { auth } = await makeMother({ user_category: EUserCategory.PP });
        const res = await arrived(auth, daysAgo(1));
        expect(res.status).toBe(403);
        expect(res.body.data.code).toBeDefined();
    });

    it("refuses a future date and a malformed one", async () => {
        const { auth } = await makeMother({ user_category: EUserCategory.NP });
        const tomorrow = new Date(Date.now() + 2 * 86_400_000).toISOString().slice(0, 10);
        expect((await arrived(auth, tomorrow)).status).toBe(400);
        expect((await arrived(auth, "yesterday")).status).toBe(400);
    });

    it("does not let the profile endpoint write the server-owned fields", async () => {
        const { userId, auth } = await makeMother({ user_category: EUserCategory.PP });
        await request(app)
            .put(`${API}/user/update-user-data`)
            .set("Authorization", auth)
            .send({ onboarding_data: { delivery_date_estimated: true } });
        const user = await UserModel.findById(userId).lean();
        expect(user?.onboarding_data?.delivery_date_estimated).not.toBe(true);
    });
});

describe("profile fields the log screens read", () => {
    const update = (auth: string, onboarding_data: object) =>
        request(app).put(`${API}/user/update-user-data`).set("Authorization", auth).send({ onboarding_data });

    it("saves height and care model, and BMI follows the height", async () => {
        const { userId, auth } = await signedInMother();

        expect((await update(auth, { height_cm: 160, care_model: "private" })).status).toBe(200);
        const user = await UserModel.findById(userId).lean();
        expect(user?.onboarding_data?.height_cm).toBe(160);
        expect(user?.onboarding_data?.care_model).toBe("private");

        await request(app)
            .post(`${API}/mother-logs`)
            .set("Authorization", auth)
            .send({ logType: "weight", fields: { weightKg: 64 } });
        const weights = await request(app)
            .get(`${API}/mother-logs?types=weight`)
            .set("Authorization", auth);
        expect(weights.body.data[0].bmi).toBe(25);
    });

    it("refuses a height out of range and a care model it does not know", async () => {
        const { userId, auth } = await signedInMother();

        expect((await update(auth, { height_cm: 1600 })).status).toBe(400);
        expect((await update(auth, { care_model: "army" })).status).toBe(400);

        const user = await UserModel.findById(userId).lean();
        expect(user?.onboarding_data?.height_cm ?? null).toBeNull();
        expect(user?.onboarding_data?.care_model ?? null).toBeNull();
    });

    it("lets her clear her height", async () => {
        const { userId, auth } = await signedInMother();
        await update(auth, { height_cm: 158 });
        expect((await update(auth, { height_cm: null })).status).toBe(200);
        expect((await UserModel.findById(userId).lean())?.onboarding_data?.height_cm).toBeNull();
    });
});
