/**
 * Import the referral codes already sitting on expert documents into
 * `referral_programs`, then report what the collection looks like afterwards.
 *
 * Runs the three referral steps in the same order the migration service uses, because
 * they depend on each other:
 *   1. drop the unique index on experts.referralCode
 *   2. create one program per coded expert
 *   3. backfill a redemption row for every user who already redeemed a code
 *
 * All three are idempotent, so re-running is safe. Step 2 is insert-only — it will
 * never overwrite a plan or seat pool an admin has since attached to a code.
 *
 * Usage:  npm run migrate:seed-referral-programs
 */
import * as dotenv from "dotenv";
dotenv.config();

import mongoose from "mongoose";
import { migrate as dropIndex } from "../src/services/migration/steps/drop-expert-referral-code-index.step";
import { migrate as seedPrograms } from "../src/services/migration/steps/seed-referral-programs-from-experts.step";
import { migrate as backfillRedemptions } from "../src/services/migration/steps/backfill-referral-redemptions.step";
import expertModel from "../src/models/expert.model";
import referralProgramModel from "../src/models/referral-program.model";

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/viva_mama";

async function run() {
    console.log(`Connecting to ${MONGO_URI.replace(/\/\/[^@]*@/, "//***:***@")} ...`);
    await mongoose.connect(MONGO_URI);
    console.log("Connected.\n");

    try {
        // An expert whose code never made it into a program would have a code that
        // resolves nowhere — worth seeing before and after, not just a count.
        const uncoded = await expertModel.countDocuments({
            $or: [{ referralCode: { $exists: false } }, { referralCode: null }, { referralCode: "" }],
        });
        if (uncoded > 0) {
            console.warn(
                `WARNING: ${uncoded} expert(s) have no referralCode. They get no program, ` +
                    `and no code. Create one for them through POST /api/v1/admin/referral-programs.\n`,
            );
        }

        console.log("1/3 drop-expert-referral-code-index");
        console.log("   ", await dropIndex());

        console.log("2/3 seed-referral-programs-from-experts");
        console.log("   ", await seedPrograms());

        console.log("3/3 backfill-referral-redemptions");
        console.log("   ", await backfillRedemptions());

        const programs = await referralProgramModel
            .find({})
            .populate("owner_expert_id", "name")
            .sort({ code: 1 })
            .lean();

        console.log(`\n${programs.length} referral program(s):\n`);
        for (const p of programs) {
            const owner = (p.owner_expert_id as unknown as { name?: string })?.name ?? "—";
            const grant = p.benefits?.grant?.planCode ?? "no grant";
            const seats = p.benefits?.seats?.total == null ? "unlimited" : `${p.benefits.seats.total}`;
            console.log(
                `  ${p.code.padEnd(16)} ${p.isActive ? "active  " : "inactive"}  ` +
                    `grant=${String(grant).padEnd(12)} seats=${seats.padEnd(9)} ${owner}`,
            );
        }

        console.log(
            "\nEvery program is created with NO grant and NO seat limit — it reproduces " +
                "today's behaviour (pin the expert) exactly.\nAttach a plan with " +
                "PATCH /api/v1/admin/referral-programs/:id.",
        );
    } catch (err) {
        console.error("Migration failed:", err);
        await mongoose.disconnect();
        process.exit(1);
    }

    await mongoose.disconnect();
    console.log("\nDisconnected.");
    process.exit(0);
}

run();
