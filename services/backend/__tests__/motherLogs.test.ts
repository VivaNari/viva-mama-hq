/**
 * The mother's log engine: the Viva AI "Log something" screens.
 *
 * One collection holds every type, so the validator carries the weight a per-type schema
 * would have: each type's fields are checked here, including that a field from another
 * type is refused. The day rule (today only) and the one-per-day / one-per-medicine
 * guarantees are asserted against a real in-memory Mongo, because the unique indexes are
 * what actually enforce them.
 *
 * Run:  npx jest motherLogs
 */

jest.mock(require.resolve("../src/config/firebase"), () => ({ __esModule: true, default: null }));
jest.mock(require.resolve("../src/config/redis.config"), () => ({ __esModule: true }));
jest.mock("razorpay", () =>
    jest.fn().mockImplementation(() => ({ orders: { create: jest.fn() } })),
);

import { Response } from "express";
import { Types } from "mongoose";

import { clearTestDb, closeTestDb, connectTestDb } from "./helpers/db";
import MotherLogController from "../src/api/v1/controllers/mother-log/mother-log.controller";
import MotherMedicineController from "../src/api/v1/controllers/mother-log/mother-medicine.controller";
import {
    motherLogCreateValidator,
    motherLogDailyValidator,
    motherMedicineCreateValidator,
} from "../src/api/v1/validators/mother-log/mother-log.validator";
import { messages } from "../src/constants/messages";
import motherLogModel from "../src/models/mother-log.model";
import UserModel from "../src/models/user.model";
import { formatDateToISO, getISTCalendarDate } from "../src/services/date/date.service";
import { ECareModel, EUserCategory } from "../src/types/user.types";

jest.setTimeout(120000);

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const today = () => formatDateToISO(getISTCalendarDate());

async function createMother(
    overrides: { careModel?: ECareModel; category?: EUserCategory; heightCm?: number } = {},
) {
    const user = await UserModel.create({
        mobile_number: `9${Math.floor(100000000 + Math.random() * 899999999)}`,
        user_category: overrides.category ?? EUserCategory.NP,
        onboarding_data: {
            care_model: overrides.careModel ?? null,
            height_cm: overrides.heightCm ?? null,
        },
    });
    return user._id.toString();
}

beforeAll(connectTestDb);
afterAll(closeTestDb);
beforeEach(clearTestDb);

/* ---------------------------- the validators ----------------------------- */

describe("the request validators", () => {
    const VALID: Record<string, object> = {
        bp: { systolic: 130, diastolic: 90 },
        sugar: { value: 110, timing: "post_meal" },
        weight: { weightKg: 58.4 },
        hb: { value: 10.8 },
        temperature: { valueF: 99.2 },
        urine_protein: { value: 1 },
        fetal_heart_rate: { bpm: 142 },
        pumping: { side: "both", minutes: 15, ml: 60 },
        meal: { mealTime: "lunch", foods: ["dal", "roti"] },
        anc_visit: { checks: ["bp", "hb"] },
    };

    it.each(Object.entries(VALID))("accepts a valid %s entry", (logType, fields) => {
        const { error } = motherLogCreateValidator.validate({ logType, fields });
        expect(error).toBeUndefined();
    });

    it("refuses a reading outside its range", () => {
        const { error } = motherLogCreateValidator.validate({
            logType: "bp",
            fields: { systolic: 1300, diastolic: 90 },
        });
        expect(error?.message).toContain("systolic");
    });

    /** One collection for every type: a field from another type must not slip in. */
    it("refuses a field that belongs to another type", () => {
        const { error } = motherLogCreateValidator.validate({
            logType: "bp",
            fields: { systolic: 120, diastolic: 80, ml: 60 },
        });
        expect(error?.message).toContain("ml");
    });

    it("refuses a meal with nothing eaten", () => {
        const { error } = motherLogCreateValidator.validate({
            logType: "meal",
            fields: { mealTime: "dinner", foods: [] },
        });
        expect(error).toBeDefined();
    });

    it("keeps the tap counters off the append endpoint and vice versa", () => {
        expect(
            motherLogCreateValidator.validate({ logType: "water", fields: { glasses: 3 } }).error,
        ).toBeDefined();
        expect(
            motherLogDailyValidator.validate({ logType: "water", fields: { glasses: 3 } }).error,
        ).toBeUndefined();
        expect(
            motherLogDailyValidator.validate({ logType: "bp", fields: { systolic: 120, diastolic: 80 } })
                .error,
        ).toBeDefined();
    });

    it("takes a medicine preset or a typed name, never both or neither", () => {
        const check = (body: object) => motherMedicineCreateValidator.validate(body).error;
        expect(check({ presetKey: "calcium", frequency: "once_a_day" })).toBeUndefined();
        expect(check({ name: "Thyroxine", frequency: "once_a_day" })).toBeUndefined();
        expect(check({ presetKey: "calcium", name: "x", frequency: "once_a_day" })).toBeDefined();
        expect(check({ frequency: "once_a_day" })).toBeDefined();
    });
});

/* --------------------------- the HTTP boundary ---------------------------- */

const respond = () => {
    const res: Record<string, unknown> = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res as unknown as Response & { status: jest.Mock; json: jest.Mock };
};

const run = async (
    handler: (req: never, res: Response, next: never) => Promise<unknown>,
    req: object,
) => {
    const res = respond();
    const next = jest.fn();
    await handler(req as never, res, next as never);
    if (next.mock.calls.length) throw next.mock.calls[0][0];
    return res;
};

const payload = (res: { json: jest.Mock }) => res.json.mock.calls[0][0].data;
const message = (res: { json: jest.Mock }) => res.json.mock.calls[0][0].message;

const logs = new MotherLogController();
const medicines = new MotherMedicineController();

const post = (userId: string, body: object) => run(logs.createLog, { body, user: { _id: userId } });
const getLogs = (userId: string, query: object) => run(logs.getLogs, { query, user: { _id: userId } });
const putDaily = (userId: string, body: object) => run(logs.setDaily, { body, user: { _id: userId } });
const remove = (userId: string, id: string) =>
    run(logs.deleteLog, { params: { id }, user: { _id: userId } });

describe("appending entries", () => {
    it("files a reading under today and stamps her route and stage", async () => {
        const userId = await createMother({ careModel: ECareModel.PRIVATE, category: EUserCategory.NP });

        const res = await post(userId, { logType: "bp", fields: { systolic: 132, diastolic: 88 } });

        expect(res.status).toHaveBeenCalledWith(200);
        expect(payload(res).logDate).toBe(today());
        const stored = await motherLogModel.findOne({ userId });
        expect(stored?.careModel).toBe(ECareModel.PRIVATE);
        expect(stored?.stage).toBe(EUserCategory.NP);
        expect(stored?.source).toBe("manual");
    });

    it("refuses an entry for an earlier day", async () => {
        const userId = await createMother();
        const yesterday = new Date(Date.now() - MS_PER_DAY).toISOString();

        const res = await post(userId, { logType: "hb", fields: { value: 10.5 }, loggedAt: yesterday });

        expect(res.status).toHaveBeenCalledWith(400);
        expect(message(res)).toBe(messages.MOTHER_LOG_DAY_CLOSED);
    });

    it("refuses an entry in the future", async () => {
        const userId = await createMother();
        const inAnHour = new Date(Date.now() + 60 * 60 * 1000).toISOString();

        const res = await post(userId, { logType: "hb", fields: { value: 10.5 }, loggedAt: inAnHour });

        expect(res.status).toHaveBeenCalledWith(400);
        expect(message(res)).toBe(messages.MOTHER_LOG_FUTURE_NOT_ALLOWED);
    });

    it("records a chat entry as coming from chat", async () => {
        const userId = await createMother();
        await post(userId, { logType: "sugar", fields: { value: 98, timing: "fasting" }, source: "chat" });
        expect((await motherLogModel.findOne({ userId }))?.source).toBe("chat");
    });
});

describe("reading history", () => {
    it("returns only the requested types, newest first", async () => {
        const userId = await createMother();
        await post(userId, { logType: "bp", fields: { systolic: 120, diastolic: 80 } });
        await post(userId, { logType: "sugar", fields: { value: 92, timing: "fasting" } });
        await post(userId, { logType: "bp", fields: { systolic: 126, diastolic: 82 } });

        const res = await getLogs(userId, { types: "bp" });

        const data = payload(res);
        expect(data).toHaveLength(2);
        expect(data[0].fields.systolic).toBe(126);
    });

    it("refuses an unknown or toggle-only type", async () => {
        const userId = await createMother();
        expect((await getLogs(userId, { types: "bp,steps" })).status).toHaveBeenCalledWith(400);
        expect((await getLogs(userId, { types: "medicine_dose" })).status).toHaveBeenCalledWith(400);
    });

    it("adds BMI to weight only when her height is known", async () => {
        const withHeight = await createMother({ heightCm: 160 });
        const without = await createMother();
        await post(withHeight, { logType: "weight", fields: { weightKg: 58.4 } });
        await post(without, { logType: "weight", fields: { weightKg: 58.4 } });

        expect(payload(await getLogs(withHeight, { types: "weight" }))[0].bmi).toBe(22.8);
        expect(payload(await getLogs(without, { types: "weight" }))[0].bmi).toBeNull();
    });

    it("never returns another mother's logs", async () => {
        const mine = await createMother();
        const theirs = await createMother();
        await post(theirs, { logType: "bp", fields: { systolic: 120, diastolic: 80 } });

        expect(payload(await getLogs(mine, {}))).toHaveLength(0);
    });
});

describe("daily tap counters", () => {
    it("keeps one water total per day, overwritten by each save", async () => {
        const userId = await createMother();
        await putDaily(userId, { logType: "water", fields: { glasses: 2 } });
        await putDaily(userId, { logType: "water", fields: { glasses: 5 } });

        const days = await motherLogModel.find({ userId, logType: "water" });
        expect(days).toHaveLength(1);
        expect(days[0]?.fields.glasses).toBe(5);
    });

    it("survives two first taps racing to create the day", async () => {
        const userId = await createMother();
        await Promise.all([
            putDaily(userId, { logType: "kicks", fields: { count: 1 } }),
            putDaily(userId, { logType: "kicks", fields: { count: 2 } }),
        ]);
        expect(await motherLogModel.countDocuments({ userId, logType: "kicks" })).toBe(1);
    });

    it("remembers when the kick count first reached ten", async () => {
        const userId = await createMother();
        await putDaily(userId, { logType: "kicks", fields: { count: 9 } });
        let day = await motherLogModel.findOne({ userId, logType: "kicks" });
        expect(day?.fields.goalReachedAt).toBeNull();

        await putDaily(userId, { logType: "kicks", fields: { count: 10 } });
        day = await motherLogModel.findOne({ userId, logType: "kicks" });
        const reachedAt = day?.fields.goalReachedAt;
        expect(reachedAt).toBeInstanceOf(Date);

        // Undoing a tap does not erase when the goal was met.
        await putDaily(userId, { logType: "kicks", fields: { count: 9 } });
        day = await motherLogModel.findOne({ userId, logType: "kicks" });
        expect(day?.fields.goalReachedAt?.getTime()).toBe(reachedAt.getTime());
    });
});

describe("removing entries", () => {
    it("removes her own entry from today", async () => {
        const userId = await createMother();
        const created = payload(await post(userId, { logType: "pumping", fields: { side: "left", minutes: 10, ml: 40 } }));

        const res = await remove(userId, String(created._id));

        expect(res.status).toHaveBeenCalledWith(200);
        expect(await motherLogModel.countDocuments({ userId })).toBe(0);
    });

    it("treats another mother's entry as not found", async () => {
        const owner = await createMother();
        const other = await createMother();
        const created = payload(await post(owner, { logType: "hb", fields: { value: 11 } }));

        const res = await remove(other, String(created._id));

        expect(res.status).toHaveBeenCalledWith(404);
        expect(await motherLogModel.countDocuments({ userId: owner })).toBe(1);
    });

    it("refuses to remove an entry from an earlier day", async () => {
        const userId = await createMother();
        const yesterday = new Date(getISTCalendarDate().getTime() - MS_PER_DAY);
        const old = await motherLogModel.create({
            userId,
            logType: "bp",
            fields: { systolic: 120, diastolic: 80 },
            logDate: yesterday,
            loggedAt: yesterday,
        });

        const res = await remove(userId, String(old._id));

        expect(res.status).toHaveBeenCalledWith(400);
        expect(message(res)).toBe(messages.MOTHER_LOG_DAY_CLOSED);
    });

    it("does not remove a daily total through the entry route", async () => {
        const userId = await createMother();
        const day = payload(await putDaily(userId, { logType: "water", fields: { glasses: 3 } }));

        expect((await remove(userId, String(day._id))).status).toHaveBeenCalledWith(404);
    });
});

describe("the ANC schedule", () => {
    const tick = (userId: string, itemId: string, done: boolean) =>
        run(logs.setAncScheduleItem, { params: { itemId }, body: { done }, user: { _id: userId } });

    it("ticks an item once however often it is ticked, and unticks it", async () => {
        const userId = await createMother();
        await tick(userId, "g1a", true);
        const res = await tick(userId, "g1a", true);
        expect(payload(res).doneItemIds).toEqual(["g1a"]);
        expect(await motherLogModel.countDocuments({ userId, logType: "anc_schedule_item" })).toBe(1);

        expect(payload(await tick(userId, "g1a", false)).doneItemIds).toEqual([]);
    });

    it("refuses an item that is not on either schedule", async () => {
        const userId = await createMother();
        expect((await tick(userId, "x9z", true)).status).toHaveBeenCalledWith(400);
    });
});

describe("medicines", () => {
    const add = (userId: string, body: object) =>
        run(medicines.addMedicine, { body, user: { _id: userId } });
    const setTaken = (userId: string, id: string, taken: boolean) =>
        run(medicines.setTaken, { params: { id }, body: { taken }, user: { _id: userId } });

    it("starts empty: nothing is seeded", async () => {
        const userId = await createMother();
        const res = await run(medicines.getMedicines, { user: { _id: userId } });
        expect(payload(res).medicines).toEqual([]);
        expect(payload(res).hasIfa).toBe(false);
    });

    it("adds a preset and a typed name", async () => {
        const userId = await createMother();
        await add(userId, { presetKey: "iron_folic_acid", frequency: "once_a_day" });
        const res = await add(userId, { name: "  Thyroxine ", frequency: "once_a_day" });

        const list = payload(res).medicines;
        expect(list).toHaveLength(2);
        expect(list[1].name).toBe("Thyroxine");
        expect(payload(res).hasIfa).toBe(true);
    });

    it("marks a medicine taken once per day, and untaken again", async () => {
        const userId = await createMother();
        const id = payload(await add(userId, { presetKey: "iron_folic_acid", frequency: "once_a_day" }))
            .medicines[0]._id;

        await setTaken(userId, String(id), true);
        const res = await setTaken(userId, String(id), true);

        expect(payload(res).medicines[0].takenToday).toBe(true);
        expect(await motherLogModel.countDocuments({ userId, logType: "medicine_dose" })).toBe(1);
        // Today is the last day of the IFA week strip.
        expect(payload(res).ifaWeek).toHaveLength(7);
        expect(payload(res).ifaWeek[6]).toBe(true);

        const undone = await setTaken(userId, String(id), false);
        expect(payload(undone).medicines[0].takenToday).toBe(false);
        expect(payload(undone).ifaWeek[6]).toBe(false);
    });

    it("refuses another mother's medicine", async () => {
        const owner = await createMother();
        const other = await createMother();
        const id = payload(await add(owner, { presetKey: "calcium", frequency: "twice_a_day" }))
            .medicines[0]._id;

        expect((await setTaken(other, String(id), true)).status).toHaveBeenCalledWith(404);
        expect((await setTaken(owner, new Types.ObjectId().toString(), true)).status).toHaveBeenCalledWith(404);
    });
});
