/**
 * Report vaccination rows that sit outside the schedule their child is on.
 *
 * READ-ONLY. It counts and prints; it changes nothing, and there is no `--execute`.
 *
 * ─── Why this exists ───────────────────────────────────────────────────────────────
 *
 * The Vaccination Log used to carry a sector switch. It was local to the screen — it
 * never wrote back to the child — but the doses tapped while it was flipped were saved
 * for real, against whatever schedule happened to be showing. The schedule is now fixed
 * at baby onboarding and the API refuses a dose that is not on the child's own schedule,
 * so those rows can no longer be created. The ones already written are still there, and
 * the screen will not render them: the visit they belong to is not in this child's list.
 *
 * Nothing here deletes them. They are real records of doses a parent says were given, and
 * a script that quietly removed health data because a UI rule changed would be the worse
 * bug. This tells you whether any exist so the question can be decided with a number
 * rather than a guess — and on a database that never saw the old build, the answer is
 * zero and there is nothing to decide.
 *
 * ─── Usage ─────────────────────────────────────────────────────────────────────────
 *
 *   npx tsx scripts/check-vaccination-sector.ts
 *   npx tsx scripts/check-vaccination-sector.ts --verbose   # list every row
 */
import "dotenv/config";
import mongoose from "mongoose";

import vaccinationLogModel from "../src/models/vaccination-log.model";
import UserModel from "../src/models/user.model";
import {
    VACCINE_KEYS_BY_SECTOR,
    VaccinationSector,
} from "../src/constants/vaccine-keys";
import { EVaccinationSector } from "../src/types/user.types";

const VERBOSE = process.argv.includes("--verbose");

/** The same fallback the controller and the app both apply: no sector means government. */
const sectorOf = (sector: unknown): VaccinationSector =>
    sector === EVaccinationSector.PRIVATE ? "private" : "public";

async function main(): Promise<void> {
    const uri = process.env.MONGO_URI;
    if (!uri) throw new Error("MONGO_URI is not set");

    await mongoose.connect(uri);
    console.log(`Connected to ${mongoose.connection.name}\n`);

    // One pass over the users to build childId -> sector. Children are embedded, so there
    // is no collection to join against and no index that would make a per-row lookup cheap.
    const sectorByChild = new Map<string, VaccinationSector>();

    const users = await UserModel.find(
        { "childs.0": { $exists: true } },
        { "childs._id": 1, "childs.vaccination_sector": 1 },
    ).lean();

    for (const user of users) {
        for (const child of user.childs ?? []) {
            if (child._id) {
                sectorByChild.set(child._id.toString(), sectorOf(child.vaccination_sector));
            }
        }
    }

    console.log(`${sectorByChild.size} children across ${users.length} users`);

    const logs = await vaccinationLogModel
        .find({}, { childId: 1, vaccineKey: 1, givenOn: 1, userId: 1 })
        .lean();

    const offSchedule: typeof logs = [];
    const orphaned: typeof logs = [];

    for (const row of logs) {
        const sector = sectorByChild.get(row.childId.toString());

        // A row whose child no longer exists is a different problem — deleteChild takes the
        // logs with it, so this should be empty, and if it is not that is worth knowing.
        if (!sector) {
            orphaned.push(row);
            continue;
        }

        const allowed = VACCINE_KEYS_BY_SECTOR[sector] as readonly string[];
        if (!allowed.includes(row.vaccineKey)) offSchedule.push(row);
    }

    console.log(`${logs.length} vaccination rows`);
    console.log(`  off-schedule: ${offSchedule.length}`);
    console.log(`  orphaned:     ${orphaned.length}`);

    if (offSchedule.length > 0) {
        const byKey = new Map<string, number>();
        for (const row of offSchedule) {
            byKey.set(row.vaccineKey, (byKey.get(row.vaccineKey) ?? 0) + 1);
        }

        console.log("\nOff-schedule doses, most common first:");
        for (const [key, count] of [...byKey].sort((a, b) => b[1] - a[1])) {
            console.log(`  ${String(count).padStart(5)}  ${key}`);
        }

        if (VERBOSE) {
            console.log("\nEvery off-schedule row:");
            for (const row of offSchedule) {
                console.log(
                    `  user=${row.userId} child=${row.childId} ` +
                        `key=${row.vaccineKey} givenOn=${row.givenOn.toISOString().slice(0, 10)}`,
                );
            }
        } else {
            console.log("\nRe-run with --verbose to list them.");
        }
    }

    await mongoose.disconnect();
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
