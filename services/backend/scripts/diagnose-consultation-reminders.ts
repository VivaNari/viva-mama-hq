/**
 * Explain, for every recently-confirmed consultation, exactly what the reminder job
 * would decide and why — without sending anything.
 *
 * The job reports counts, not reasons, and `sendPushNotification` swallows FCM errors,
 * so "sent: 1" does not prove a phone was reached. This prints the state each decision
 * is actually made from.
 *
 * Run:  npx ts-node scripts/diagnose-consultation-reminders.ts
 *       npx ts-node scripts/diagnose-consultation-reminders.ts <consultationId>
 *       AT="2026-08-03T19:04:00+05:30" npx ts-node scripts/diagnose-consultation-reminders.ts
 *         ^ pretend "now" is that moment, to test a schedule without waiting for it
 */
import mongoose from "mongoose";
import * as path from "path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

import consultationModel from "../src/models/consultation.model";
import UserModel from "../src/models/user.model";
import {
    CONSULTATION_REMINDER_OFFSETS_MINUTES,
    CONSULTATION_REMINDER_TOLERANCE_MINUTES,
} from "../src/constants/consultation-slots";
import { CallbackRequestStatusEnum } from "../src/types/consultation.types";

const MINUTE_MS = 60_000;
const IST = "Asia/Kolkata";

const ist = (d: Date) =>
    new Intl.DateTimeFormat("en-IN", {
        timeZone: IST,
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
    }).format(d);

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
    const targetId = process.argv[2];

    await mongoose.connect(buildMongoUri());

    console.log("=".repeat(78));
    console.log(`NOW              ${ist(now)} IST   (${now.toISOString()})`);
    console.log(
        `offsets          ${CONSULTATION_REMINDER_OFFSETS_MINUTES.join(", ")} minutes before`,
    );
    console.log(`tolerance        ${CONSULTATION_REMINDER_TOLERANCE_MINUTES} minutes`);
    console.log("=".repeat(78));

    const filter: Record<string, unknown> = targetId
        ? { _id: targetId }
        : { meeting_confirmed_at: { $ne: null } };

    const consultations = await consultationModel
        .find(filter)
        .sort({ meeting_confirmed_at: -1 })
        .limit(targetId ? 1 : 10)
        .lean();

    if (consultations.length === 0) {
        console.log("\nNo consultation found with a confirmed time.");
        console.log("=> Reminders only ever fire for a booking whose meeting_confirmed_at is set.");
        await mongoose.disconnect();
        return;
    }

    for (const c of consultations) {
        const confirmedAt = c.meeting_confirmed_at ? new Date(c.meeting_confirmed_at) : null;
        const user = await UserModel.findById(c.userId).select("FCM_token").lean();

        console.log(`\n--- consultation ${c._id} ---`);
        console.log(`  confirmed at   ${confirmedAt ? ist(confirmedAt) : "(null)"} IST`);
        console.log(`  stored as      ${confirmedAt ? confirmedAt.toISOString() : "(null)"}`);
        console.log(`  requestStatus  ${c.requestStatus ?? "(null)"}`);
        console.log(`  reminders_sent ${JSON.stringify(c.reminders_sent ?? "(field absent)")}`);
        console.log(`  FCM token      ${user?.FCM_token ? "present" : "MISSING"}`);

        // Gate 1: the query. A consultation that fails this is never even considered.
        const blockers: string[] = [];
        if (c.requestStatus !== CallbackRequestStatusEnum.PENDING) {
            blockers.push(`requestStatus is "${c.requestStatus}", the job only looks at PENDING`);
        }
        if (!confirmedAt) blockers.push("no meeting_confirmed_at");
        if (!user?.FCM_token) blockers.push("user has no FCM_token — nothing to push to");

        if (blockers.length) {
            console.log(`  BLOCKED: ${blockers.join("; ")}`);
            continue;
        }

        // Gate 2: per-offset timing.
        for (const offset of CONSULTATION_REMINDER_OFFSETS_MINUTES) {
            const dueAt = new Date(confirmedAt!.getTime() - offset * MINUTE_MS);
            const lateByMin = (now.getTime() - dueAt.getTime()) / MINUTE_MS;
            const already = (c.reminders_sent ?? []).includes(offset);

            let verdict: string;
            if (already) {
                verdict = "ALREADY SENT (recorded in reminders_sent)";
            } else if (lateByMin < 0) {
                verdict = `TOO EARLY by ${Math.abs(lateByMin).toFixed(1)} min — fires on a run at or after ${ist(dueAt)}`;
            } else if (lateByMin > CONSULTATION_REMINDER_TOLERANCE_MINUTES) {
                verdict = `TOO LATE by ${lateByMin.toFixed(1)} min (tolerance ${CONSULTATION_REMINDER_TOLERANCE_MINUTES}) — permanently skipped`;
            } else {
                verdict = `WOULD SEND NOW (${lateByMin.toFixed(1)} min past due)`;
            }

            console.log(`  T-${String(offset).padStart(2)}min  due ${ist(dueAt)}  ->  ${verdict}`);
        }
    }

    console.log(
        "\nNote: the job counts a reminder as sent once it hands it to FCM. " +
            "sendPushNotification swallows FCM errors, so a stale or wrong device token " +
            "looks identical to a delivered push.",
    );

    await mongoose.disconnect();
}

run().catch(async (err) => {
    console.error("Diagnosis failed:", err);
    await mongoose.disconnect();
    process.exit(1);
});
