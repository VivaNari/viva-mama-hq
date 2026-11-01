/**
 * Moves reminders from the four fixed slots to exact times: sets `timeMinutes` from the
 * old `timeOfDay` (morning 08:00, afternoon 13:00, evening 18:00, night 21:00) and
 * removes `timeOfDay`.
 *
 * Run once per environment, before the backend that reads `timeMinutes` starts sending.
 * Safe to run again: reminders that already have `timeMinutes` are left alone.
 *
 * Run:  npx ts-node scripts/migrate-reminder-times.ts
 */
import mongoose from "mongoose";
import * as path from "path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

import { REMINDER_QUICK_TIMES } from "../src/types/reminder.types";

const buildMongoUri = () => {
    const {
        MONGO_URI,
        MONGODB_HOST,
        MONGODB_PORT,
        MONGODB_USERNAME,
        MONGODB_PASSWORD,
        MONGODB_DATABASE,
    } = process.env;
    if (MONGO_URI) return MONGO_URI;
    const username = encodeURIComponent(MONGODB_USERNAME || "");
    const password = encodeURIComponent(MONGODB_PASSWORD || "");
    const host = MONGODB_HOST || "localhost";
    const port = MONGODB_PORT || "27017";
    const database = MONGODB_DATABASE || "viva_mama";
    if (username && password) {
        return `mongodb://${username}:${password}@${host}:${port}/${database}?authSource=admin`;
    }
    return `mongodb://${host}:${port}/${database}`;
};

export const migrateReminderTimes = async (): Promise<number> => {
    const reminders = mongoose.connection.collection("mother_reminders");
    let migrated = 0;
    for (const [slot, minutes] of Object.entries(REMINDER_QUICK_TIMES)) {
        const result = await reminders.updateMany(
            { timeOfDay: slot, timeMinutes: { $exists: false } },
            { $set: { timeMinutes: minutes }, $unset: { timeOfDay: "" } },
        );
        migrated += result.modifiedCount;
    }
    return migrated;
};

async function run() {
    await mongoose.connect(buildMongoUri());
    console.log(`Database: ${mongoose.connection.host}/${mongoose.connection.name}`);
    console.log(`Migrated ${await migrateReminderTimes()} reminder(s) to exact times.`);
    await mongoose.disconnect();
}

if (require.main === module) {
    run().catch(async (err) => {
        console.error("Migration failed:", err);
        await mongoose.disconnect();
        process.exit(1);
    });
}
