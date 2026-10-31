/**
 * Run the custom reminder job once, right now, and print what it did.
 *
 * Exists because there is no other way to trigger it on demand: the in-process cron only
 * fires on its schedule, and the HTTP endpoint is behind Cloud Scheduler OIDC. Testing
 * by editing the cron expression means guessing a minute and waiting for it.
 *
 * This sends real pushes — it is the job, not a simulation.
 *
 * Run:  npm run job:custom-reminders
 *       AT="2026-11-02T13:05:00+05:30" npm run job:custom-reminders
 *         ^ pretend "now" is that moment. Always pass an explicit +05:30 offset; a bare
 *           timestamp is read as UTC and lands 5.5 hours away from what you meant.
 */
import mongoose from "mongoose";
import * as path from "path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

// Initialises Firebase Admin as a side effect. The server gets this through its
// imports; a standalone script must load it itself or every push fails.
import "../src/config/firebase";
import { customReminders } from "../src/cron-jobs/customReminders";

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

async function run() {
    const now = process.env.AT ? new Date(process.env.AT) : new Date();
    if (Number.isNaN(now.getTime())) {
        throw new Error(`AT is not a valid date: "${process.env.AT}"`);
    }

    await mongoose.connect(buildMongoUri());
    // Host and database only, never the credentials: shows which data this run will touch.
    console.log(`Database: ${mongoose.connection.host}/${mongoose.connection.name}`);

    const istNow = new Intl.DateTimeFormat("en-IN", {
        timeZone: "Asia/Kolkata",
        dateStyle: "medium",
        timeStyle: "medium",
    }).format(now);
    console.log(`Running custom reminders as of ${istNow} IST (${now.toISOString()})`);

    const result = await customReminders(now);

    console.log("Result:", result);
    if (result.sent === 0) {
        console.log(
            "Nothing sent. A reminder goes out up to 60 minutes after its slot (08:00, 13:00, 18:00, 21:00 IST), once a day, to users with an FCM token.",
        );
    }

    await mongoose.disconnect();
}

run().catch(async (err) => {
    console.error("Job failed:", err);
    await mongoose.disconnect();
    process.exit(1);
});
