/**
 * Reminders: the repeat rule, the routes through the real Express app, and the job that
 * pushes them.
 *
 * Run:  npx jest reminders
 */

jest.mock(require.resolve("../src/config/firebase"), () => ({ __esModule: true, default: null }));
jest.mock(require.resolve("../src/config/redis.config"), () => ({ __esModule: true }));
jest.mock("razorpay", () =>
    jest.fn().mockImplementation(() => ({ orders: { create: jest.fn() } })),
);

const sendPushNotificationMock = jest.fn(async () => undefined);
jest.mock(require.resolve("../src/utils/sendPushNotification"), () => ({
    __esModule: true,
    sendPushNotification: (...args: unknown[]) => sendPushNotificationMock(...(args as [])),
}));

import jwt from "jsonwebtoken";
import request from "supertest";

import { clearTestDb, closeTestDb, connectTestDb } from "./helpers/db";
import app from "../src/app";
import env from "../src/config/env";
import { customReminders } from "../src/cron-jobs/customReminders";
import motherReminderModel from "../src/models/mother-reminder.model";
import UserModel from "../src/models/user.model";
import { isDueOn, istClock, slotsToSend } from "../src/services/reminders/reminder-schedule";
import ReminderService from "../src/services/reminders/reminder.service";
import { ECareModel, EUserCategory } from "../src/types/user.types";

jest.setTimeout(120000);

const API = "/api/v1";
// Monday 2 Nov 2026, as IST wall-clock times.
const at = (time: string, day = "2026-11-02") => new Date(`${day}T${time}:00+05:30`);

async function mother(extra: Record<string, unknown> = {}) {
    const user = await UserModel.create({
        mobile_number: `9${Math.floor(100000000 + Math.random() * 899999999)}`,
        user_category: EUserCategory.NP,
        FCM_token: "token-1",
        ...extra,
    });
    const token = jwt.sign({ _id: user._id.toString() }, env.JWT_SECRET as string);
    return { userId: user._id.toString(), auth: `Bearer ${token}` };
}

beforeAll(connectTestDb);
afterAll(closeTestDb);
beforeEach(async () => {
    await clearTestDb();
    sendPushNotificationMock.mockClear();
});

describe("repeat rule", () => {
    const base = { weekdays: [] as number[], startDate: "2026-11-02", endDate: null };

    it.each([
        ["daily", "2026-11-05", true],
        ["alternateDays", "2026-11-04", true],
        ["alternateDays", "2026-11-03", false],
        ["weekly", "2026-11-09", true],
        ["weekly", "2026-11-08", false],
    ] as const)("%s on %s → %s", (frequency, day, expected) => {
        expect(isDueOn({ ...base, frequency }, day)).toBe(expected);
    });

    it("custom follows the chosen weekdays", () => {
        // 0 = Sunday, 3 = Wednesday
        const reminder = { ...base, frequency: "custom" as const, weekdays: [0, 3] };
        expect(isDueOn(reminder, "2026-11-04")).toBe(true);
        expect(isDueOn(reminder, "2026-11-08")).toBe(true);
        expect(isDueOn(reminder, "2026-11-05")).toBe(false);
    });

    it("is never due before the start or after the end", () => {
        const reminder = { ...base, frequency: "daily" as const, endDate: "2026-11-29" };
        expect(isDueOn(reminder, "2026-11-01")).toBe(false);
        expect(isDueOn(reminder, "2026-11-29")).toBe(true);
        expect(isDueOn(reminder, "2026-11-30")).toBe(false);
    });

    it("reads the IST day and clock, not UTC", () => {
        // 00:30 IST on 3 Nov is still 2 Nov in UTC.
        expect(istClock(at("00:30", "2026-11-03"))).toEqual({ today: "2026-11-03", minutes: 30 });
    });

    it("sends a slot from its time until 60 minutes later", () => {
        expect(slotsToSend(7 * 60 + 59)).toEqual([]);
        expect(slotsToSend(8 * 60)).toEqual(["morning"]);
        expect(slotsToSend(9 * 60)).toEqual(["morning"]);
        expect(slotsToSend(9 * 60 + 1)).toEqual([]);
    });
});

describe("reminder routes", () => {
    it("refuses a request without a token", async () => {
        expect((await request(app).get(`${API}/mother-reminders`)).status).toBe(401);
    });

    it("creates, lists and deletes her reminder", async () => {
        const { auth } = await mother({ onboarding_data: { care_model: ECareModel.PRIVATE } });

        const created = await request(app)
            .post(`${API}/mother-reminders`)
            .set("Authorization", auth)
            .send({ category: "other", detail: "  Journaling ", timeOfDay: "night", frequency: "daily", endWeeks: 4 });
        expect(created.status).toBe(201);
        expect(created.body.data).toMatchObject({
            category: "other",
            detail: "Journaling",
            careModel: ECareModel.PRIVATE,
        });

        const listed = await request(app).get(`${API}/mother-reminders`).set("Authorization", auth);
        expect(listed.body.data.reminders).toHaveLength(1);

        const removed = await request(app)
            .delete(`${API}/mother-reminders/${created.body.data._id}`)
            .set("Authorization", auth);
        expect(removed.status).toBe(200);
        expect(await motherReminderModel.countDocuments()).toBe(0);
    });

    it("rejects custom without weekdays, and detail outside 'other'", async () => {
        const { auth } = await mother();
        const custom = await request(app)
            .post(`${API}/mother-reminders`)
            .set("Authorization", auth)
            .send({ category: "medicine", timeOfDay: "morning", frequency: "custom" });
        expect(custom.status).toBe(400);

        const detail = await request(app)
            .post(`${API}/mother-reminders`)
            .set("Authorization", auth)
            .send({ category: "medicine", detail: "x", timeOfDay: "morning", frequency: "daily" });
        expect(detail.status).toBe(400);
    });

    it("never deletes another mother's reminder", async () => {
        const owner = await mother();
        const other = await mother();
        const created = await request(app)
            .post(`${API}/mother-reminders`)
            .set("Authorization", owner.auth)
            .send({ category: "meals", timeOfDay: "afternoon", frequency: "daily" });

        const res = await request(app)
            .delete(`${API}/mother-reminders/${created.body.data._id}`)
            .set("Authorization", other.auth);
        expect(res.status).toBe(404);
        expect(await motherReminderModel.countDocuments()).toBe(1);
    });

    it("stops at 20 active reminders", async () => {
        const { userId, auth } = await mother();
        await motherReminderModel.insertMany(
            Array.from({ length: 20 }, () => ({
                userId,
                category: "medicine",
                timeOfDay: "morning",
                frequency: "daily",
                startDate: "2026-01-01",
            })),
        );
        const res = await request(app)
            .post(`${API}/mother-reminders`)
            .set("Authorization", auth)
            .send({ category: "meals", timeOfDay: "afternoon", frequency: "daily" });
        expect(res.status).toBe(400);
    });
});

describe("reminder service", () => {
    const service = new ReminderService();

    it("starts today, and a slot already past today starts tomorrow", async () => {
        const { userId } = await mother();
        const morning = await service.create(
            userId,
            { category: "medicine", timeOfDay: "morning", frequency: "daily", endWeeks: 1 },
            at("08:10"),
        );
        expect(morning).toMatchObject({
            startDate: "2026-11-02",
            endDate: "2026-11-08",
            lastSentDate: "2026-11-02",
        });

        const evening = await service.create(
            userId,
            { category: "medicine", timeOfDay: "evening", frequency: "daily" },
            at("08:10"),
        );
        expect(evening).toMatchObject({ endDate: null, lastSentDate: null });
    });

    it("hides reminders whose end date has passed", async () => {
        const { userId } = await mother();
        await motherReminderModel.create({
            userId,
            category: "tests",
            timeOfDay: "morning",
            frequency: "daily",
            startDate: "2026-10-01",
            endDate: "2026-10-28",
        });
        expect(await service.list(userId, at("09:00"))).toHaveLength(0);
    });
});

describe("custom reminders job", () => {
    const seed = (userId: string, extra: Record<string, unknown> = {}) =>
        motherReminderModel.create({
            userId,
            category: "medicine",
            timeOfDay: "afternoon",
            frequency: "daily",
            startDate: "2026-11-01",
            ...extra,
        });

    it("sends a due reminder once, even when run again", async () => {
        const { userId } = await mother();
        const reminder = await seed(userId);

        expect(await customReminders(at("13:05"))).toMatchObject({ due: 1, sent: 1 });
        expect(sendPushNotificationMock).toHaveBeenCalledTimes(1);
        const [payload] = sendPushNotificationMock.mock.calls[0] as unknown as [
            { token: string; title: string; data: Record<string, string> },
        ];
        expect(payload.token).toBe("token-1");
        expect(payload.title).toContain("medicine");
        expect(payload.data).toEqual({
            type: "CUSTOM_REMINDER",
            reminderId: String(reminder._id),
            category: "medicine",
        });

        expect(await customReminders(at("13:20"))).toMatchObject({ sent: 0 });
        expect(sendPushNotificationMock).toHaveBeenCalledTimes(1);

        // Sends again the next day.
        await customReminders(at("13:05", "2026-11-03"));
        expect(sendPushNotificationMock).toHaveBeenCalledTimes(2);
    });

    it("does not send before the slot or more than an hour late", async () => {
        const { userId } = await mother();
        await seed(userId);
        await customReminders(at("12:55"));
        await customReminders(at("14:10"));
        expect(sendPushNotificationMock).not.toHaveBeenCalled();
    });

    it("skips days the frequency does not cover, ended reminders and missing tokens", async () => {
        const { userId } = await mother();
        // 1 Nov start: 2 Nov is an off day.
        await seed(userId, { frequency: "alternateDays" });
        await seed(userId, { startDate: "2026-10-01", endDate: "2026-10-31" });
        const noToken = await mother({ FCM_token: null });
        await seed(noToken.userId);

        expect(await customReminders(at("13:05"))).toMatchObject({ sent: 0 });
        expect(sendPushNotificationMock).not.toHaveBeenCalled();
    });

    it("uses her language, and her own words for 'other'", async () => {
        const { userId } = await mother({ preferred_language: "hi" });
        await seed(userId);
        await seed(userId, { category: "other", detail: "Journaling" });

        await customReminders(at("13:05"));
        const titles = sendPushNotificationMock.mock.calls.map(
            (call) => (call as unknown as [{ title: string }])[0].title,
        );
        expect(titles).toEqual(expect.arrayContaining(["दवा का समय 💊", "Journaling"]));
    });
});
