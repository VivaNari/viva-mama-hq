/**
 * The one-off move from fixed slots to exact times.
 *
 * Run:  npx jest migrateReminderTimes
 */
import mongoose from "mongoose";

import { clearTestDb, closeTestDb, connectTestDb } from "./helpers/db";
import { migrateReminderTimes } from "../scripts/migrate-reminder-times";

jest.setTimeout(120000);

beforeAll(connectTestDb);
afterAll(closeTestDb);
beforeEach(clearTestDb);

it("sets each slot's time, drops the slot, and is safe to run again", async () => {
    const reminders = mongoose.connection.collection("mother_reminders");
    const userId = new mongoose.Types.ObjectId();
    await reminders.insertMany([
        { userId, timeOfDay: "morning", frequency: "daily" },
        { userId, timeOfDay: "night", frequency: "daily" },
        { userId, timeMinutes: 1170, frequency: "daily" },
    ]);

    expect(await migrateReminderTimes()).toBe(2);
    expect(await migrateReminderTimes()).toBe(0);

    const times = (await reminders.find().toArray()).map((r) => [r.timeMinutes, r.timeOfDay]);
    expect(times).toEqual(
        expect.arrayContaining([
            [480, undefined],
            [1260, undefined],
            [1170, undefined],
        ]),
    );
});
