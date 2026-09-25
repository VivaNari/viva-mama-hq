/**
 * The order-collection reshape, run against a real engine.
 *
 * Worth a test because the failure mode is silence: this step originally targeted
 * `book_consultation_orders`, while the model registers as "bookConsultation_orders" and
 * therefore lives in `bookconsultation_orders`. It matched nothing, modified nothing, and
 * reported success — leaving every paid order unmigrated with no signal that anything
 * had gone wrong.
 */

jest.mock(require.resolve("../src/config/firebase"), () => ({ __esModule: true, default: null }));
jest.mock(require.resolve("../src/config/redis.config"), () => ({ __esModule: true }));

import { clearTestDb, closeTestDb, connectTestDb } from "./helpers/db";
import bookConsultationOrderModel from "../src/models/book-consultation.model";
import { migrate } from "../src/services/migration/steps/migrate-consultation-order-to-consultant-ref.step";
import { ConsultationTypeEnum } from "../src/types/consultation.types";
import mongoose from "mongoose";

jest.setTimeout(120000);

/** Bypasses the schema: `expert_id` no longer exists on it. */
const raw = () => bookConsultationOrderModel.collection;

async function seedLegacyOrder(orderId: string, expertId: mongoose.Types.ObjectId) {
    await raw().insertOne({
        order_id: orderId,
        receipt: `receipt_${orderId}`,
        user_id: new mongoose.Types.ObjectId(),
        expert_id: expertId,
        amount: 80_000,
        currency: "INR",
        status: "paid",
        preferred_consultation_date: new Date(),
    });
}

beforeAll(connectTestDb);
afterAll(closeTestDb);
beforeEach(async () => {
    await clearTestDb();
    jest.spyOn(console, "log").mockImplementation(() => undefined);
});
afterEach(() => jest.restoreAllMocks());

describe("migrate-consultation-order-to-consultant-ref", () => {
    it("targets the collection the model actually uses", () => {
        // The guard against the original bug. If the model's registered name changes,
        // this fails here rather than silently in production.
        expect(raw().collectionName).toBe("bookconsultation_orders");
    });

    it("renames expert_id and stamps the type", async () => {
        const expertId = new mongoose.Types.ObjectId();
        await seedLegacyOrder("legacy_1", expertId);

        const result = await migrate();

        expect(result).toEqual({ renamed: 1, typed: 1 });

        const migrated = await raw().findOne({ order_id: "legacy_1" });
        expect(String(migrated!.consultant_id)).toBe(String(expertId));
        expect(migrated!.consultation_type).toBe(ConsultationTypeEnum.EXPERT);
        expect(migrated!.expert_id).toBeUndefined();
    });

    it("leaves the rest of the order untouched", async () => {
        await seedLegacyOrder("legacy_2", new mongoose.Types.ObjectId());

        await migrate();

        const migrated = await raw().findOne({ order_id: "legacy_2" });
        expect(migrated!.amount).toBe(80_000);
        expect(migrated!.status).toBe("paid");
        expect(migrated!.receipt).toBe("receipt_legacy_2");
    });

    it("is a no-op on a second run", async () => {
        await seedLegacyOrder("legacy_3", new mongoose.Types.ObjectId());
        await migrate();

        // Idempotent: a re-run after a partial failure must finish the job, not redo it.
        expect(await migrate()).toEqual({ renamed: 0, typed: 0 });
    });

    it("does not overwrite a care-manager order written by the new code", async () => {
        const careManagerId = new mongoose.Types.ObjectId();
        await raw().insertOne({
            order_id: "new_cm",
            user_id: new mongoose.Types.ObjectId(),
            consultant_id: careManagerId,
            consultation_type: ConsultationTypeEnum.CARE_MANAGER,
            amount: 9_900,
            status: "created",
        });

        await migrate();

        // Stamping every untyped row EXPERT is only safe because rows written by the new
        // code already carry a type. Clobbering this one would send a counsellor booking
        // to the expert collection on verify.
        const untouched = await raw().findOne({ order_id: "new_cm" });
        expect(untouched!.consultation_type).toBe(ConsultationTypeEnum.CARE_MANAGER);
        expect(String(untouched!.consultant_id)).toBe(String(careManagerId));
    });

    it("migrates a mixed batch in one pass", async () => {
        await seedLegacyOrder("legacy_a", new mongoose.Types.ObjectId());
        await seedLegacyOrder("legacy_b", new mongoose.Types.ObjectId());
        await raw().insertOne({
            order_id: "already_new",
            consultant_id: new mongoose.Types.ObjectId(),
            consultation_type: ConsultationTypeEnum.EXPERT,
            amount: 80_000,
        });

        expect(await migrate()).toEqual({ renamed: 2, typed: 2 });
        expect(await raw().countDocuments({ expert_id: { $exists: true } })).toBe(0);
        expect(await raw().countDocuments({ consultation_type: { $exists: false } })).toBe(0);
    });
});
