jest.mock(require.resolve("../src/config/firebase"), () => ({ __esModule: true, default: null }));
jest.mock(require.resolve("../src/config/redis.config"), () => ({ __esModule: true }));
jest.mock("razorpay", () =>
    jest.fn().mockImplementation(() => ({ orders: { create: jest.fn() } })),
);
jest.mock(require.resolve("../src/utils/sendPushNotification"), () => ({
    __esModule: true,
    sendPushNotification: jest.fn(async () => undefined),
}));
jest.mock(
    require.resolve("../src/services/getgabs/sendWhatsappMessageForConsultationBooking"),
    () => ({
        __esModule: true,
        EConsultationBookingTemplate: {
            EXPERT: "expert_consultation_booking_v2",
            CARE_MANAGER: "care_manager_callback_v2",
        },
        sendWhatsappMessageForConsultationBooking: jest.fn(async () => undefined),
    }),
);
// Booking now mints a Meet room before notifying. Stubbed to null — the "Meet is off or
// unreachable" path — so these tests keep asserting credit behaviour and never reach out
// to Google.
jest.mock(require.resolve("../src/services/google-meet/meet-space.service"), () => ({
    __esModule: true,
    meetSpaceService: { createMeetSpace: jest.fn(async () => null) },
}));

import { connectTestDb, closeTestDb, clearTestDb } from "./helpers/db";
import UserModel from "../src/models/user.model";
import consultationModel from "../src/models/consultation.model";
import consultationCreditModel from "../src/models/consultation-credit.model";
import careManagerModel from "../src/models/care-manager.model";
import expertModel from "../src/models/expert.model";
import expertCategoryModel from "../src/models/expert-category.model";
import subscriptionModel from "../src/models/subscription.model";
import { ConsultationService } from "../src/services/consultations/consultation.service";
import { creditService } from "../src/services/entitlements/credit.service";
import {
    EBillingMode,
    EBillingProvider,
    ECreditType,
    EConsultationPaymentMode,
    EPlanCode,
    ESubscriptionStatus,
    ESubscriptionTier,
} from "../src/types/subscription.types";
import { CallbackRequestStatusEnum } from "../src/types/consultation.types";

jest.setTimeout(120000);

const service = new ConsultationService();

/**
 * A real, empanelled expert, recreated per test because clearTestDb wipes between them.
 *
 * This used to be a bare id string with no document behind it. Booking now resolves the
 * expert up front to check empanelment, so the document has to exist — and every test
 * below that spends a credit implicitly asserts the expert is on the panel.
 */
let EXPERT_ID: string;

/** `key` is unique and enum-constrained, so tests share one category rather than each minting its own. */
async function ensureCategory() {
    return expertCategoryModel.findOneAndUpdate(
        { key: "GYNECOLOGIST" },
        { $setOnInsert: { key: "GYNECOLOGIST", name: "Gynaecologist", coveredAreas: ["a"] } },
        { upsert: true, new: true },
    );
}

async function makeExpert(overrides: Record<string, unknown> = {}) {
    const category = await ensureCategory();
    return expertModel.create({
        name: "Dr. Anita Rao",
        speciality: "Gynaecology",
        category: category._id,
        yearsOfExperience: 12,
        photograph: "https://example.com/a.jpg",
        remuneration: 199,
        is_empanelled_expert: true,
        // `referralCode` is unique+sparse but defaults to null, and a sparse index still
        // indexes an explicit null — so two experts without a code collide. Given one
        // per expert here to keep that out of these tests.
        referralCode: `REF${Math.random().toString(36).slice(2, 10)}`,
        ...overrides,
    });
}

/** A premium user with a live subscription and a granted credit bucket. */
async function premiumUser(credits = { expert: 1, careManager: 1 }) {
    const periodEnd = new Date(Date.now() + 30 * 86_400_000);
    const user = await UserModel.create({
        mobile_number: `9${Math.floor(Math.random() * 1_000_000_000)}`,
        subscription: {
            tier: ESubscriptionTier.PREMIUM,
            planCode: EPlanCode.MONTHLY,
            currentPeriodEnd: periodEnd,
            hasUsedTrial: true,
        },
    });

    const subscription = await subscriptionModel.create({
        user_id: user._id,
        planCode: EPlanCode.MONTHLY,
        tier: ESubscriptionTier.PREMIUM,
        status: ESubscriptionStatus.ACTIVE,
        billingMode: EBillingMode.MANUAL,
        provider: EBillingProvider.RAZORPAY_ORDERS,
        currentPeriodStart: new Date(),
        currentPeriodEnd: periodEnd,
        isCurrent: true,
    });

    await creditService.grantForPlan({
        userId: user._id,
        subscriptionId: subscription._id,
        credits,
        expiresAt: periodEnd,
    });

    await UserModel.findByIdAndUpdate(user._id, {
        $set: { "subscription.subscription_id": subscription._id },
    });

    return { user, subscription, periodEnd };
}

async function tierUser(tier: ESubscriptionTier) {
    return UserModel.create({
        mobile_number: `9${Math.floor(Math.random() * 1_000_000_000)}`,
        subscription: {
            tier,
            trialEndAt:
                tier === ESubscriptionTier.TRIAL ? new Date(Date.now() + 5 * 86_400_000) : null,
            hasUsedTrial: tier !== ESubscriptionTier.FREE,
        },
    });
}

async function makeCareManager() {
    return careManagerModel.create({
        name: "CM",
        email: "cm@example.com",
        phoneNumber: "9000000000",
    });
}

beforeAll(connectTestDb);
afterAll(closeTestDb);
beforeEach(async () => {
    await clearTestDb();
    EXPERT_ID = String((await makeExpert())._id);
});

describe("book expert with credit", () => {
    it("books and spends exactly one expert credit", async () => {
        const { user } = await premiumUser();

        const consultation = await service.bookExpertWithCredit(
            String(user._id),
            EXPERT_ID,
            new Date(),
        );

        expect(consultation).toBeTruthy();
        const stored = await consultationModel.findById((consultation as any)._id);
        expect(stored!.paymentMode).toBe(EConsultationPaymentMode.CREDIT);
        expect(stored!.credit_ledger_id).not.toBeNull();

        // Only the expert bucket moves.
        expect(await creditService.getBalances(user._id)).toEqual({
            expert: 0,
            careManager: 1,
        });
    });

    // Credits are a PREMIUM mechanism; these tiers use pay-per-session instead.
    it.each([ESubscriptionTier.FREE, ESubscriptionTier.TRIAL])(
        "refuses %s with NO_CREDITS",
        async (tier) => {
            const user = await tierUser(tier);
            await expect(
                service.bookExpertWithCredit(String(user._id), EXPERT_ID, new Date()),
            ).rejects.toMatchObject({ code: "NO_CREDITS" });
        },
    );

    it("refuses once the bucket is empty", async () => {
        const { user } = await premiumUser({ expert: 1, careManager: 0 });
        await service.bookExpertWithCredit(String(user._id), EXPERT_ID, new Date());

        await expect(
            service.bookExpertWithCredit(String(user._id), EXPERT_ID, new Date()),
        ).rejects.toThrow();
    });

    /**
     * A booking must never exist without the credit that paid for it — otherwise the
     * user gets a free consultation every time the spend fails.
     */
    it("leaves no orphan consultation when the spend fails", async () => {
        const { user } = await premiumUser({ expert: 1, careManager: 0 });
        await service.bookExpertWithCredit(String(user._id), EXPERT_ID, new Date());

        await service
            .bookExpertWithCredit(String(user._id), EXPERT_ID, new Date())
            .catch(() => undefined);

        // Exactly one consultation: the successful one. The rolled-back attempt is gone.
        expect(await consultationModel.countDocuments({ userId: user._id })).toBe(1);
    });

    it("lets only one of four parallel bookings win on a single credit", async () => {
        const { user } = await premiumUser({ expert: 1, careManager: 0 });

        const results = await Promise.all(
            Array.from({ length: 4 }, () =>
                service
                    .bookExpertWithCredit(String(user._id), EXPERT_ID, new Date())
                    .then(() => "ok" as const)
                    .catch(() => "denied" as const),
            ),
        );

        expect(results.filter((r) => r === "ok")).toHaveLength(1);
        expect(await creditService.getBalance(user._id, ECreditType.EXPERT)).toBe(0);
        expect(await consultationModel.countDocuments({ userId: user._id })).toBe(1);
    });
});

/**
 * A credit is priced against the in-house session fee. Six of them spent on a ₹700
 * specialist costs more to fulfil than the ₹3,999 plan brought in, so the external panel
 * is pay-per-session only — however many credits the user is holding.
 */
describe("empanelment", () => {
    it("refuses an off-panel expert without touching the ledger", async () => {
        const { user } = await premiumUser();
        const offPanel = await makeExpert({ remuneration: 700, is_empanelled_expert: false });

        await expect(
            service.bookExpertWithCredit(String(user._id), String(offPanel._id), new Date()),
        ).rejects.toMatchObject({ code: "EXPERT_NOT_EMPANELLED", statusCode: 409 });

        // Refused before anything is written: the credit is intact and there is no
        // half-made booking to clean up.
        expect(await creditService.getBalances(user._id)).toEqual({ expert: 1, careManager: 1 });
        expect(await consultationModel.countDocuments({ userId: user._id })).toBe(0);
    });

    it("refuses an expert id that names nobody", async () => {
        const { user } = await premiumUser();

        await expect(
            service.bookExpertWithCredit(String(user._id), "5f0000000000000000000aaa", new Date()),
        ).rejects.toMatchObject({ code: "EXPERT_NOT_FOUND", statusCode: 404 });

        expect(await creditService.getBalance(user._id, ECreditType.EXPERT)).toBe(1);
    });

    /**
     * The flag is the only thing that decides this — an empanelled expert who happens to
     * charge a lot is still bookable with a credit. Empanelment is a commercial decision
     * about a named doctor, not something inferred from the fee.
     */
    it("allows an empanelled expert regardless of fee", async () => {
        const { user } = await premiumUser();
        const pricey = await makeExpert({ remuneration: 700, is_empanelled_expert: true });

        await expect(
            service.bookExpertWithCredit(String(user._id), String(pricey._id), new Date()),
        ).resolves.toBeTruthy();

        expect(await creditService.getBalance(user._id, ECreditType.EXPERT)).toBe(0);
    });

    /**
     * A referring doctor on a zero fee sees her patients at her own clinic and takes no
     * in-app bookings at all. Flagged empanelled here deliberately: that is the one
     * combination the empanelment check alone lets through, and a credit spent on her
     * would buy a session the app never arranges.
     */
    it("refuses an in-person-only expert even when she is empanelled", async () => {
        const { user } = await premiumUser();
        const inPerson = await makeExpert({ remuneration: 0, is_empanelled_expert: true });

        await expect(
            service.bookExpertWithCredit(String(user._id), String(inPerson._id), new Date()),
        ).rejects.toMatchObject({ code: "EXPERT_IN_PERSON_ONLY", statusCode: 409 });

        expect(await creditService.getBalances(user._id)).toEqual({ expert: 1, careManager: 1 });
        expect(await consultationModel.countDocuments({ userId: user._id })).toBe(0);
    });

    it("defaults a newly created expert to off-panel", async () => {
        const created = await expertModel.create({
            name: "Dr. Unset",
            speciality: "General",
            category: (await ensureCategory())!._id,
            yearsOfExperience: 3,
            photograph: "https://example.com/u.jpg",
            remuneration: 500,
            referralCode: "REFUNSET",
        });

        expect(created.is_empanelled_expert).toBe(false);
    });
});

describe("care manager callback", () => {
    it("spends a care-manager credit for a premium user", async () => {
        const { user } = await premiumUser();
        const cm = await makeCareManager();

        await service.requestCallback(String(user._id), String(cm._id), new Date());

        expect(await creditService.getBalances(user._id)).toEqual({
            expert: 1,
            careManager: 0,
        });
    });

    /**
     * The capability is open at every tier now, but the credit route still needs a
     * credit. FREE and TRIAL have no care-manager bucket by construction, so this route
     * refuses with NO_CREDITS — not LOCKED_FEATURE — and the app sends them through
     * Razorpay instead. Exactly how experts have always behaved.
     */
    it.each([ESubscriptionTier.FREE, ESubscriptionTier.TRIAL])(
        "refuses the credit route with NO_CREDITS for %s",
        async (tier) => {
            const user = await tierUser(tier);
            const cm = await makeCareManager();

            await expect(
                service.requestCallback(String(user._id), String(cm._id), new Date()),
            ).rejects.toMatchObject({ code: "NO_CREDITS" });

            // No booking is left behind for a call that was never paid for.
            expect(await consultationModel.countDocuments({ userId: user._id })).toBe(0);
        },
    );
});

describe("refund on UNHANDLED", () => {
    it("returns the credit and records it as a new ledger row", async () => {
        const { user } = await premiumUser();
        const consultation = await service.bookExpertWithCredit(
            String(user._id),
            EXPERT_ID,
            new Date(),
        );
        expect(await creditService.getBalance(user._id, ECreditType.EXPERT)).toBe(0);

        await service.markUnhandled(String((consultation as any)._id));

        expect(await creditService.getBalance(user._id, ECreditType.EXPERT)).toBe(1);

        // Append-only: the CONSUME row survives alongside the REFUND.
        const rows = await consultationCreditModel
            .find({ user_id: user._id, type: ECreditType.EXPERT })
            .sort({ seq: 1 });
        expect(rows.map((r) => r.reason)).toEqual(["GRANT", "CONSUME", "REFUND"]);

        const stored = await consultationModel.findById((consultation as any)._id);
        expect(stored!.requestStatus).toBe(CallbackRequestStatusEnum.UNHANDLED);
    });

    // Calling it twice must not mint a credit out of nothing.
    it("is idempotent", async () => {
        const { user } = await premiumUser();
        const consultation = await service.bookExpertWithCredit(
            String(user._id),
            EXPERT_ID,
            new Date(),
        );

        const id = String((consultation as any)._id);
        await service.markUnhandled(id);
        await service.markUnhandled(id);

        expect(await creditService.getBalance(user._id, ECreditType.EXPERT)).toBe(1);
    });

    it("refunds the care-manager bucket for a care-manager callback", async () => {
        const { user } = await premiumUser();
        const cm = await makeCareManager();
        await service.requestCallback(String(user._id), String(cm._id), new Date());

        const consultation = await consultationModel.findOne({ userId: user._id });
        await service.markUnhandled(String(consultation!._id));

        expect(await creditService.getBalances(user._id)).toEqual({
            expert: 1,
            careManager: 1,
        });
    });

    // A pay-per-session booking refunds through the gateway, not the ledger.
    it("does not touch the ledger for a PAID consultation", async () => {
        const { user } = await premiumUser();
        const paid = await consultationModel.create({
            userId: user._id,
            consultatorId: EXPERT_ID,
            consultationType: "EXPERT",
            requestStatus: CallbackRequestStatusEnum.PENDING,
            preferred_consultation_date: new Date(),
            paymentMode: EConsultationPaymentMode.PAID,
            credit_ledger_id: null,
        });

        await service.markUnhandled(String(paid._id));

        expect(await creditService.getBalance(user._id, ECreditType.EXPERT)).toBe(1);
    });
});
