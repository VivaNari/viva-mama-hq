/**
 * Migration idempotency.
 *
 * There is no migration ledger — POST /api/v1/admin/migrate/run-all re-runs every step
 * on every invocation — so "runs twice without damage" is not a nicety here, it is the
 * correctness condition. Each case runs its step twice and asserts the second run is
 * inert.
 *
 * Run:  npx jest referral.migration
 */
jest.mock(require.resolve("../src/config/firebase"), () => ({ __esModule: true, default: null }));
jest.mock(require.resolve("../src/config/redis.config"), () => ({ __esModule: true }));

import { connectTestDb, closeTestDb, clearTestDb } from "./helpers/db";
import UserModel from "../src/models/user.model";
import expertModel from "../src/models/expert.model";
import expertCategoryModel from "../src/models/expert-category.model";
import referralProgramModel from "../src/models/referral-program.model";
import referralRedemptionModel from "../src/models/referral-redemption.model";
import { migrate as seedProgramsFromExperts } from "../src/services/migration/steps/seed-referral-programs-from-experts.step";
import { migrate as backfillRedemptions } from "../src/services/migration/steps/backfill-referral-redemptions.step";
import { migrate as dropReferralCodeIndex } from "../src/services/migration/steps/drop-expert-referral-code-index.step";
import { EReferralRedemptionStatus } from "../src/types/referral.types";
import { EPlanCode } from "../src/types/subscription.types";
import { EExpertCategory } from "../src/types/expert.types";

jest.setTimeout(120000);

async function makeExpert(name: string, referralCode: string | null) {
    const category =
        (await expertCategoryModel.findOne({ key: EExpertCategory.GYNECOLOGIST })) ??
        (await expertCategoryModel.create({
            key: EExpertCategory.GYNECOLOGIST,
            name: "Gynecologist",
            description: "d",
            coveredAreas: [],
            isActive: true,
        }));

    return expertModel.create({
        name,
        speciality: "Gynecology",
        category: category._id,
        referralCode,
        yearsOfExperience: 5,
        photograph: "img",
        remuneration: 500,
        isActive: true,
    });
}

beforeAll(connectTestDb);
afterAll(closeTestDb);
beforeEach(clearTestDb);

describe("seed-referral-programs-from-experts", () => {
    it("creates one program per coded expert and skips uncoded ones", async () => {
        await makeExpert("Dr Sujana Roy", "DRSUJANA12026");
        await makeExpert("Dr Anita Rao", "AR12026");
        await makeExpert("Dr No Code", null);

        const result = await seedProgramsFromExperts();

        expect(result.upserted).toBe(2);
        expect(await referralProgramModel.countDocuments({})).toBe(2);

        const program = await referralProgramModel.findOne({ code: "DRSUJANA12026" }).lean();
        // A seeded program reproduces today's behaviour exactly: pin the expert, grant
        // nothing, suppress nothing. It waits to be configured.
        expect(program!.benefits.grant.planCode).toBeNull();
        expect(program!.benefits.seats.total).toBeNull();
        expect(program!.benefits.entitlementOverrides).toEqual([]);
    });

    /**
     * The reason the step is $setOnInsert. A $set would wipe the plan an admin attached
     * to a partner's code the moment anyone triggered a migration run — and the endpoint
     * that triggers one is reachable by a scheduler, not a human deciding to.
     */
    it("never reverts a program configured between runs", async () => {
        await makeExpert("Dr Sujana Roy", "DRSUJANA12026");
        await seedProgramsFromExperts();

        await referralProgramModel.updateOne(
            { code: "DRSUJANA12026" },
            {
                $set: {
                    "benefits.grant.planCode": EPlanCode.MONTHLY,
                    "benefits.seats.total": 500,
                    displayName: "Sujana pilot",
                },
            },
        );

        const second = await seedProgramsFromExperts();

        expect(second.upserted).toBe(0);
        const program = await referralProgramModel.findOne({ code: "DRSUJANA12026" }).lean();
        expect(program!.benefits.grant.planCode).toBe(EPlanCode.MONTHLY);
        expect(program!.benefits.seats.total).toBe(500);
        expect(program!.displayName).toBe("Sujana pilot");
        expect(await referralProgramModel.countDocuments({})).toBe(1);
    });

    it("normalises a lower-case stored code to the canonical form", async () => {
        await makeExpert("Dr Lower", "lower12026");
        await seedProgramsFromExperts();
        expect(await referralProgramModel.findOne({ code: "LOWER12026" }).lean()).toBeTruthy();
    });
});

describe("backfill-referral-redemptions", () => {
    it("writes a ledger row per historic redeemer and marks unknown codes as orphans", async () => {
        const expert = await makeExpert("Dr Sujana Roy", "DRSUJANA12026");
        await seedProgramsFromExperts();

        await UserModel.create({
            mobile_number: "9000000001",
            expert_referral_code: "DRSUJANA12026",
            referred_by_expert_id: expert._id,
        });
        // The old endpoint stored whatever string it was handed, typos included.
        await UserModel.create({
            mobile_number: "9000000002",
            expert_referral_code: "TYPOD CODE".replace(" ", ""),
        });
        await UserModel.create({ mobile_number: "9000000003" });

        const result = await backfillRedemptions();

        expect(result.inserted).toBe(2);
        expect(result.orphans).toBe(1);

        const good = await referralRedemptionModel.findOne({ code: "DRSUJANA12026" }).lean();
        expect(good!.status).toBe(EReferralRedemptionStatus.COMPLETED);
        expect(good!.program_id).not.toBeNull();
        expect(good!.seatClaimed).toBe(false);

        const orphan = await referralRedemptionModel.findOne({ code: "TYPODCODE" }).lean();
        expect(orphan!.status).toBe(EReferralRedemptionStatus.FAILED);
        expect(orphan!.failureReason).toBe("ORPHAN_CODE");
        // No program is invented for junk — it would become a live, redeemable code.
        expect(orphan!.program_id).toBeNull();
        expect(await referralProgramModel.countDocuments({})).toBe(1);
    });

    /**
     * Idempotency here is a caught E11000, not an upsert — an upsert would rewrite
     * `redeemedAt` on every run and the dates would creep forward forever.
     */
    it("leaves row count and redeemedAt untouched on a second run", async () => {
        const expert = await makeExpert("Dr Sujana Roy", "DRSUJANA12026");
        await seedProgramsFromExperts();
        await UserModel.create({
            mobile_number: "9000000004",
            expert_referral_code: "DRSUJANA12026",
            referred_by_expert_id: expert._id,
        });

        await backfillRedemptions();
        const first = await referralRedemptionModel.findOne({}).lean();

        const second = await backfillRedemptions();

        expect(second.inserted).toBe(0);
        expect(second.skipped).toBe(1);
        expect(await referralRedemptionModel.countDocuments({})).toBe(1);

        const after = await referralRedemptionModel.findOne({}).lean();
        expect(after!.redeemedAt).toEqual(first!.redeemedAt);
    });
});

describe("drop-expert-referral-code-index", () => {
    it("is a no-op when there is no unique index to drop", async () => {
        // connectTestDb runs syncIndexes against the current schema, which no longer
        // declares one — so this asserts the step tolerates an already-clean database.
        const result = await dropReferralCodeIndex();
        expect(result.dropped).toEqual([]);
    });

    it("lets two experts exist without codes once the index is gone", async () => {
        await dropReferralCodeIndex();

        // The bug it fixes: both default referralCode to null, a sparse index still
        // indexes an explicit null, so the second insert used to throw E11000.
        await expect(makeExpert("Dr One", null)).resolves.toBeTruthy();
        await expect(makeExpert("Dr Two", null)).resolves.toBeTruthy();

        expect(await expertModel.countDocuments({ referralCode: null })).toBe(2);
    });
});
