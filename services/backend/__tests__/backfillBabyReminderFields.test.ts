/**
 * backfill-baby-reminder-fields: the migration that gives every pre-existing child
 * `pending_vaccination_reminders` / `pending_milestone_reminders: []`.
 *
 * `UserModel.create()` would apply the schema's `default: []` itself, which is exactly the
 * behaviour this step exists to cover for documents that predate it — so every "legacy
 * child" fixture here goes in through `UserModel.collection.insertOne`, bypassing Mongoose
 * entirely, the same way a document written before this schema change actually looks.
 *
 * Run:  npx jest backfillBabyReminderFields
 */
jest.mock(require.resolve("../src/config/firebase"), () => ({ __esModule: true, default: null }));
jest.mock(require.resolve("../src/config/redis.config"), () => ({ __esModule: true }));

import { Types } from "mongoose";

import { clearTestDb, closeTestDb, connectTestDb } from "./helpers/db";
import UserModel from "../src/models/user.model";
import { migrate } from "../src/services/migration/steps/backfill-baby-reminder-fields.step";

jest.setTimeout(120000);

/** A child document exactly as it looked before this migration existed — neither field present. */
const legacyChild = (overrides: Record<string, unknown> = {}) => ({
    _id: new Types.ObjectId(),
    name: "Aarav",
    date_of_birth: new Date("2026-03-14"),
    sex: "Male",
    onboarding_status: "COMPLETED",
    ...overrides,
});

const insertLegacyUser = (childs: object[]) =>
    UserModel.collection.insertOne({
        phone_number: `9${Math.floor(100000000 + Math.random() * 899999999)}`,
        childs,
    });

beforeAll(connectTestDb);
afterAll(closeTestDb);
beforeEach(clearTestDb);

describe("backfill-baby-reminder-fields", () => {
    it("gives a legacy child both fields as empty arrays", async () => {
        const { insertedId } = await insertLegacyUser([legacyChild()]);

        const result = await migrate();
        expect(result.usersUpdated).toBe(1);

        const user = await UserModel.findById(insertedId).lean();
        expect(user!.childs[0]!.pending_vaccination_reminders).toEqual([]);
        expect(user!.childs[0]!.pending_milestone_reminders).toEqual([]);
    });

    it("backfills every legacy child across multiple users", async () => {
        await insertLegacyUser([legacyChild(), legacyChild({ name: "Diya" })]);
        await insertLegacyUser([legacyChild({ name: "Rohan" })]);

        const result = await migrate();
        expect(result.usersUpdated).toBe(2);

        const users = await UserModel.find({}).lean();
        for (const user of users) {
            for (const child of user.childs) {
                expect(child.pending_vaccination_reminders).toEqual([]);
                expect(child.pending_milestone_reminders).toEqual([]);
            }
        }
    });

    it("leaves a child that already has real pending reminders untouched", async () => {
        const pending = [{ visitKey: "6w", firstDueOn: new Date("2026-04-25"), lastRemindedOn: null }];
        const { insertedId } = await insertLegacyUser([
            legacyChild({
                pending_vaccination_reminders: pending,
                pending_milestone_reminders: [],
            }),
        ]);

        await migrate();

        const user = await UserModel.findById(insertedId).lean();
        expect(user!.childs[0]!.pending_vaccination_reminders).toEqual(pending);
    });

    it("backfills only the field actually missing when a child has one but not the other", async () => {
        const { insertedId } = await insertLegacyUser([
            legacyChild({ pending_vaccination_reminders: [] }), // milestone field still missing
        ]);

        const result = await migrate();
        expect(result.usersUpdated).toBe(1);

        const user = await UserModel.findById(insertedId).lean();
        expect(user!.childs[0]!.pending_vaccination_reminders).toEqual([]);
        expect(user!.childs[0]!.pending_milestone_reminders).toEqual([]);
    });

    it("is idempotent: a second run touches nothing", async () => {
        await insertLegacyUser([legacyChild(), legacyChild({ name: "Diya" })]);

        await migrate();
        const second = await migrate();

        expect(second.usersUpdated).toBe(0);
    });

    it("does nothing when there are no children at all", async () => {
        const result = await migrate();
        expect(result.usersUpdated).toBe(0);
    });
});
