import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";

/**
 * In-memory MongoDB for tests that need real database behaviour: unique indexes,
 * atomic $inc upserts, and the partial indexes the subscription model relies on.
 *
 * The existing suites mock their way around the database, which is why
 * payments_selectFreePlan.test.ts kept passing while the service beneath it was
 * rewritten. Anything that guards money or quota needs to run against a real engine.
 */

let mongod: MongoMemoryServer | null = null;

export async function connectTestDb(): Promise<void> {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());
    // Indexes are what enforce "one live subscription per user" and "one CONSUME row per
    // consultation". Mongoose builds them lazily, so without this the very guarantees
    // under test would not exist yet.
    await mongoose.connection.syncIndexes();
}

export async function closeTestDb(): Promise<void> {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
    await mongod?.stop();
    mongod = null;
}

/** Wipe every collection between tests without paying to rebuild indexes. */
export async function clearTestDb(): Promise<void> {
    const collections = await mongoose.connection.db!.collections();
    await Promise.all(collections.map((c) => c.deleteMany({})));
}
