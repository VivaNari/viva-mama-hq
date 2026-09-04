/**
 * Delete every user-created record, leaving the seeded catalog intact.
 *
 * Written for the cut-over to public launch: the database carries months of
 * development and Play licence-tester traffic, and none of it should be visible to the
 * first real user. It empties the collections people fill and leaves the ones the team
 * seeds — content, products, experts, plans, flows.
 *
 * ─── Safety ────────────────────────────────────────────────────────────────────────
 *
 * This is the most destructive script in the repository and it is meant to be run
 * against production, so the guards are deliberately tedious:
 *
 *  1. DRY RUN BY DEFAULT. Without `--execute` it only counts and prints.
 *  2. `--db=<name>` must match the database the URI actually resolves to. A stale
 *     MONGO_URI pointing at the wrong environment aborts instead of wiping it.
 *  3. `PURGE_CONFIRM` must be the exact phrase, so no `--execute` typed from shell
 *     history can fire on its own.
 *  4. Production needs `PURGE_ALLOW_PROD=yes` on top of everything else.
 *
 * The important guard is none of those, though: this works from an ALLOWLIST. A
 * collection is emptied only if it is named in PURGE, and preserved only if named in
 * PRESERVE. Anything in the database that appears in neither list ABORTS the run.
 *
 * That is the whole design. A denylist would silently wipe any collection added after
 * this file was written — the failure mode being data loss nobody notices until a user
 * reports it. Failing closed turns that into a build error: whoever adds a collection
 * has to say which side it belongs on, and the worst case is an operator reruns the
 * command after a one-line edit.
 *
 * ─── Usage ─────────────────────────────────────────────────────────────────────────
 *
 *   npm run purge:user-data -- --db=viva_mama                  # dry run, safe
 *
 *   PURGE_CONFIRM="DELETE ALL USER DATA" \
 *     npm run purge:user-data -- --db=viva_mama --execute
 *
 *   # production also needs:
 *   PURGE_ALLOW_PROD=yes
 *
 *   # optionally reset the user_id sequence back to zero:
 *   --reset-counters
 */
import mongoose from "mongoose";
import * as path from "path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

/** The exact value PURGE_CONFIRM must hold. Long and unguessable on purpose. */
const CONFIRM_PHRASE = "DELETE ALL USER DATA";

/**
 * Collections emptied by this script: everything a user or their activity creates.
 *
 * Mirrors the collections `account-deletion.service.ts` clears for a single user, which
 * is the codebase's existing answer to "what is this person's data" — plus four it does
 * not touch because they are not per-user erasure targets, but are still development
 * residue that must not survive into launch:
 *
 *   otps            short-lived login codes; expire on their own, but stale rows in a
 *                   fresh database are confusing
 *   payment_orders  Razorpay checkout attempts from testing
 *   webhook_events  the provider event ledger, almost entirely licence-tester traffic
 *   bookconsultation_orders   consultation bookings placed during testing
 */
const PURGE: readonly string[] = [
    "users",
    "subscriptions",
    "consultation_credits",
    "consultations",
    "consultation_reviews",
    "bookconsultation_orders",
    "payment_orders",
    "conversations",
    "messages",
    "ai_message_bookmarks",
    "mood_logs",
    "flow_instances",
    "flow_responses",
    "recommendation_histories",
    "supports",
    "analytics_events",
    "usage_counters",
    "referral_redemptions",
    "viva_club_posts",
    "viva_club_comments",
    "reports",
    "otps",
    "webhook_events",
];

/**
 * Collections deliberately left alone: the catalog the team seeds and the app reads.
 *
 * Emptying any of these leaves a launched app with no content, no plans to sell and no
 * experts to book — recoverable only by re-running every seed script in order.
 *
 * `counters` holds the user_id auto-increment sequence rather than catalog data. It is
 * preserved by default because a sequence that only ever moves forward cannot collide
 * with anything; `--reset-counters` sets it back to zero for a genuinely clean start,
 * which is safe once `users` is empty but is not the default, because "safe once" is a
 * claim about the state at the moment it runs.
 */
const PRESERVE: readonly string[] = [
    "contents",
    "products",
    "experts",
    "expert_categories",
    "care_managers",
    "recommendations",
    "flow_definitions",
    "flow_node_categories",
    "subscription_plans",
    "referral_programs",
    "organizations",
    "counters",
];

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

const arg = (name: string): string | undefined => {
    const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
    return hit ? hit.slice(name.length + 3) : undefined;
};
const flag = (name: string): boolean => process.argv.includes(`--${name}`);

function fail(message: string): never {
    console.error(`\n  ABORTED: ${message}\n`);
    process.exit(1);
}

async function main(): Promise<void> {
    const execute = flag("execute");
    const resetCounters = flag("reset-counters");
    const expectedDb = arg("db");

    if (!expectedDb) {
        fail("--db=<name> is required. It must match the database the URI resolves to.");
    }

    await mongoose.connect(buildMongoUri());
    const db = mongoose.connection.db;
    if (!db) fail("Connected, but no database handle was returned.");

    const actualDb = db.databaseName;

    // Guard 2. Checked after connecting, because the point is to compare against the
    // database actually reached rather than the one the operator believed they typed.
    if (actualDb !== expectedDb) {
        fail(
            `--db=${expectedDb} but the connection resolved to "${actualDb}".\n` +
                `  Refusing to touch a database the operator did not name.`,
        );
    }

    const live = (await db.listCollections().toArray()).map((c) => c.name).sort();

    // The load-bearing guard. Every collection present must be classified; an unknown
    // one stops the run rather than being guessed at in either direction.
    const unclassified = live.filter((n) => !PURGE.includes(n) && !PRESERVE.includes(n));
    if (unclassified.length) {
        fail(
            `${unclassified.length} collection(s) are in neither PURGE nor PRESERVE:\n` +
                unclassified.map((n) => `    - ${n}`).join("\n") +
                `\n\n  Add each one to a list in ${path.basename(__filename)} and re-run.\n` +
                `  This is intentional: an unclassified collection is a decision nobody has\n` +
                `  made yet, and neither wiping it nor keeping it is safe to assume.`,
        );
    }

    const counts = new Map<string, number>();
    for (const name of PURGE) {
        counts.set(name, live.includes(name) ? await db.collection(name).countDocuments() : -1);
    }
    const total = [...counts.values()].filter((n) => n > 0).reduce((a, b) => a + b, 0);

    console.log(`\n  Database   ${actualDb}`);
    console.log(`  Mode       ${execute ? "EXECUTE — data will be deleted" : "DRY RUN"}`);
    console.log(`  Preserving ${PRESERVE.length} catalog collections\n`);
    console.log("  Collection                          documents");
    console.log("  " + "-".repeat(46));
    for (const name of PURGE) {
        const n = counts.get(name)!;
        const shown = n < 0 ? "absent" : String(n);
        console.log("  " + (name + " ".repeat(36)).slice(0, 36) + shown.padStart(9));
    }
    console.log("  " + "-".repeat(46));
    console.log("  " + "TOTAL".padEnd(36) + String(total).padStart(9) + "\n");

    if (!execute) {
        console.log("  Dry run only. Nothing was deleted.");
        console.log("  To execute:");
        console.log(`    PURGE_CONFIRM="${CONFIRM_PHRASE}" \\`);
        console.log(`      npx ts-node scripts/purge-user-data.ts --db=${actualDb} --execute\n`);
        await mongoose.disconnect();
        return;
    }

    // Guard 3.
    if (process.env.PURGE_CONFIRM !== CONFIRM_PHRASE) {
        fail(`--execute requires PURGE_CONFIRM to be exactly:  ${CONFIRM_PHRASE}`);
    }

    // Guard 4. Production is not special-cased to be easier.
    if (process.env.NODE_ENV === "production" && process.env.PURGE_ALLOW_PROD !== "yes") {
        fail("NODE_ENV is production. Set PURGE_ALLOW_PROD=yes to proceed.");
    }

    console.log("  Deleting...\n");
    let deleted = 0;
    for (const name of PURGE) {
        if (!live.includes(name)) continue;
        const res = await db.collection(name).deleteMany({});
        deleted += res.deletedCount ?? 0;
        console.log(
            "  " + (name + " ".repeat(36)).slice(0, 36) + String(res.deletedCount).padStart(9),
        );
    }

    if (resetCounters && live.includes("counters")) {
        const res = await db.collection("counters").updateMany({}, { $set: { seq: 0 } });
        console.log(`\n  counters reset to zero (${res.modifiedCount} sequence(s))`);
    }

    console.log(`\n  Done. ${deleted} document(s) deleted.`);
    console.log("  Catalog collections were not touched:");
    for (const name of PRESERVE) {
        if (!live.includes(name)) continue;
        console.log(`    ${(name + " ".repeat(30)).slice(0, 30)}${await db
            .collection(name)
            .countDocuments()} kept`);
    }
    console.log("");

    await mongoose.disconnect();
}

main().catch(async (error) => {
    console.error("\n  FAILED:", error);
    await mongoose.disconnect().catch(() => undefined);
    process.exit(1);
});
