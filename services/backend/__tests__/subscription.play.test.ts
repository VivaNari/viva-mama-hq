jest.mock(require.resolve("../src/config/firebase"), () => ({ __esModule: true, default: null }));
jest.mock(require.resolve("../src/config/redis.config"), () => ({ __esModule: true }));
jest.mock("razorpay", () =>
    jest.fn().mockImplementation(() => ({ orders: { create: jest.fn() } })),
);

import { connectTestDb, closeTestDb, clearTestDb } from "./helpers/db";
import subscriptionModel from "../src/models/subscription.model";
import subscriptionPlanModel from "../src/models/subscription-plan.model";
import UserModel from "../src/models/user.model";
import consultationCreditModel from "../src/models/consultation-credit.model";
import { subscriptionService } from "../src/services/subscription/subscription.service";
import { entitlementService } from "../src/services/entitlements/entitlement.service";
import {
    __setBillingProviderForTests,
    EPlaySubscriptionState,
    obfuscatedPlayAccountId,
    PLAY_ACKNOWLEDGED,
    PLAY_PRODUCTS,
} from "../src/services/subscription/billing";
import { creditService } from "../src/services/entitlements/credit.service";
import {
    EBillingMode,
    EBillingProvider,
    ECreditType,
    EPlanCode,
    ESubscriptionStatus,
    ESubscriptionTier,
} from "../src/types/subscription.types";

jest.setTimeout(120000);

const MONTHLY_PRODUCT = PLAY_PRODUCTS[EPlanCode.MONTHLY].productId;
const MONTHLY_BASE_PLAN = PLAY_PRODUCTS[EPlanCode.MONTHLY].basePlanId;

/** 42 days out — deliberately NOT the plan's 30 days, so a locally computed date fails. */
const PLAY_EXPIRY = new Date(Date.now() + 42 * 86_400_000);

/**
 * Stand-in for the Play Developer API. `getSubscription` is the only thing that reaches
 * the network in the real provider, so overriding it plus `acknowledge` is enough to
 * exercise the whole activation path deterministically.
 */
function makePlayStub(overrides: Record<string, unknown> = {}) {
    return {
        mode: EBillingMode.PLAY,
        name: EBillingProvider.GOOGLE_PLAY,
        startTrial: jest.fn(async () => ({ providerSubscriptionId: null, mandateStatus: null })),
        createCheckout: jest.fn(async () => {
            throw new Error("RAIL_NOT_SUPPORTED");
        }),
        verify: jest.fn(async () => {
            throw new Error("RAIL_NOT_SUPPORTED");
        }),
        cancel: jest.fn(async () => undefined),
        acknowledge: jest.fn(async () => undefined),
        getSubscription: jest.fn(async () => ({
            subscriptionState: EPlaySubscriptionState.ACTIVE,
            startTime: new Date().toISOString(),
            latestOrderId: "GPA.1234-5678-9012-34567",
            externalAccountIdentifiers: {
                obfuscatedExternalAccountId: currentAccountId,
            },
            lineItems: [
                {
                    productId: MONTHLY_PRODUCT,
                    expiryTime: PLAY_EXPIRY.toISOString(),
                    offerDetails: { basePlanId: MONTHLY_BASE_PLAN },
                },
            ],
            ...overrides,
        })),
    };
}

/** Set per test before calling activate, so the stub can echo the right account id. */
let currentAccountId = "";
let playStub: ReturnType<typeof makePlayStub>;

async function makeUser() {
    return UserModel.create({
        mobile_number: `9${Math.floor(Math.random() * 1_000_000_000)}`,
        is_onboarded: { is_questionnaire_completed: true, is_subscription_completed: false },
    });
}

async function seedPlans() {
    await subscriptionPlanModel.create([
        {
            code: EPlanCode.MONTHLY,
            displayName: "Monthly",
            amountPaise: 149_900,
            durationDays: 30,
            credits: { expert: 1, careManager: 1 },
            playProductId: MONTHLY_PRODUCT,
            playBasePlanId: MONTHLY_BASE_PLAN,
        },
    ]);
}

/** Installs a stub whose payload is the default overridden by `overrides`. */
function installStub(overrides: Record<string, unknown> = {}) {
    playStub = makePlayStub(overrides);
    __setBillingProviderForTests(EBillingMode.PLAY, playStub as any);
    return playStub;
}

beforeAll(connectTestDb);

afterAll(async () => {
    __setBillingProviderForTests(EBillingMode.PLAY, null);
    await closeTestDb();
});

beforeEach(async () => {
    await clearTestDb();
    await seedPlans();
    installStub();
});

describe("activateFromPlayPurchase", () => {
    it("activates from a Play purchase and grants the plan's credits", async () => {
        const user = await makeUser();
        currentAccountId = obfuscatedPlayAccountId(user._id);

        const sub = await subscriptionService.activateFromPlayPurchase(user._id, {
            purchaseToken: "token_happy",
            productId: MONTHLY_PRODUCT,
        });

        expect(sub.tier).toBe(ESubscriptionTier.PREMIUM);
        expect(sub.status).toBe(ESubscriptionStatus.ACTIVE);
        expect(sub.planCode).toBe(EPlanCode.MONTHLY);
        expect(sub.billingMode).toBe(EBillingMode.PLAY);
        expect(sub.provider).toBe(EBillingProvider.GOOGLE_PLAY);
        expect(sub.playPurchaseToken).toBe("token_happy");

        const credits = await consultationCreditModel
            .find({ user_id: user._id, type: ECreditType.EXPERT })
            .lean();
        expect(credits).toHaveLength(1);
        expect(credits[0].balanceAfter).toBe(1);
    });

    it("takes the period end from Google, not from the plan's durationDays", async () => {
        // The guard against the whole class of bug this rail invites. Google owns the
        // billing calendar — trials, grace periods, holds and proration all move the
        // expiry — so a date computed from durationDays drifts from what the user sees
        // in the Play app, and Play is the one that is right.
        const user = await makeUser();
        currentAccountId = obfuscatedPlayAccountId(user._id);

        const sub = await subscriptionService.activateFromPlayPurchase(user._id, {
            purchaseToken: "token_dates",
            productId: MONTHLY_PRODUCT,
        });

        expect(sub.currentPeriodEnd!.toISOString()).toBe(PLAY_EXPIRY.toISOString());

        // And explicitly not the 30 days the MONTHLY plan would have produced.
        const localWouldBe = new Date();
        localWouldBe.setDate(localWouldBe.getDate() + 30);
        expect(
            Math.abs(sub.currentPeriodEnd!.getTime() - localWouldBe.getTime()),
        ).toBeGreaterThan(86_400_000);
    });

    it("acknowledges the purchase, and only after the row is committed", async () => {
        // Unacknowledged purchases are auto-refunded by Google after three days, so the
        // call has to happen. It has to happen last, too: acknowledging before the row
        // exists would leave Google believing a purchase was delivered that this system
        // has no record of.
        const user = await makeUser();
        currentAccountId = obfuscatedPlayAccountId(user._id);

        let rowExistedAtAckTime = false;
        playStub.acknowledge.mockImplementation(async () => {
            rowExistedAtAckTime = Boolean(
                await subscriptionModel.exists({ playPurchaseToken: "token_ack" }),
            );
        });

        await subscriptionService.activateFromPlayPurchase(user._id, {
            purchaseToken: "token_ack",
            productId: MONTHLY_PRODUCT,
        });

        expect(playStub.acknowledge).toHaveBeenCalledWith("token_ack", MONTHLY_PRODUCT);
        expect(rowExistedAtAckTime).toBe(true);
    });

    it("still activates when acknowledgement fails", async () => {
        // The user has paid and is entitled. Losing the activation over a failed
        // acknowledge would be strictly worse than the refund risk it protects against,
        // which the RTDN path re-attempts anyway.
        const user = await makeUser();
        currentAccountId = obfuscatedPlayAccountId(user._id);
        playStub.acknowledge.mockRejectedValue(new Error("network"));

        const sub = await subscriptionService.activateFromPlayPurchase(user._id, {
            purchaseToken: "token_ack_fail",
            productId: MONTHLY_PRODUCT,
        });

        expect(sub.status).toBe(ESubscriptionStatus.ACTIVE);
    });

    it("is idempotent on the purchase token", async () => {
        // The client retries verification after a network failure, and RTDN can report
        // the same purchase independently. Neither may create a second term.
        const user = await makeUser();
        currentAccountId = obfuscatedPlayAccountId(user._id);

        const first = await subscriptionService.activateFromPlayPurchase(user._id, {
            purchaseToken: "token_idem",
            productId: MONTHLY_PRODUCT,
        });
        const second = await subscriptionService.activateFromPlayPurchase(user._id, {
            purchaseToken: "token_idem",
            productId: MONTHLY_PRODUCT,
        });

        expect(String(second._id)).toBe(String(first._id));
        expect(second.currentPeriodEnd!.toISOString()).toBe(
            first.currentPeriodEnd!.toISOString(),
        );

        const rows = await subscriptionModel.find({ user_id: user._id }).lean();
        expect(rows).toHaveLength(1);

        const credits = await consultationCreditModel
            .find({ user_id: user._id, type: ECreditType.EXPERT })
            .lean();
        expect(credits).toHaveLength(1);
    });

    it("acknowledges again on a re-verify when Google still reports it unacknowledged", async () => {
        // Regression. Acknowledgement lived past an early return that a re-verify never
        // reached, so a single transient Play failure was permanent — and Google
        // auto-refunds an unacknowledged subscription after three days. The client
        // re-reports precisely the purchases Play still lists as unacknowledged, so every
        // retry arrived at the one path that could not act on it: the user paid, kept
        // access for three days, then lost it with nothing in this system to explain why.
        const user = await makeUser();
        currentAccountId = obfuscatedPlayAccountId(user._id);

        installStub({ acknowledgementState: "ACKNOWLEDGEMENT_STATE_PENDING" });
        playStub.acknowledge.mockRejectedValueOnce(new Error("network"));

        await subscriptionService.activateFromPlayPurchase(user._id, {
            purchaseToken: "token_ack_retry",
            productId: MONTHLY_PRODUCT,
        });
        expect(playStub.acknowledge).toHaveBeenCalledTimes(1);

        // The sweep re-reports it on the next foreground, and this time it must land.
        await subscriptionService.activateFromPlayPurchase(user._id, {
            purchaseToken: "token_ack_retry",
            productId: MONTHLY_PRODUCT,
        });
        expect(playStub.acknowledge).toHaveBeenCalledTimes(2);
    });

    it("stops acknowledging once Google reports the purchase acknowledged", async () => {
        // What terminates the retry above. Without it the client would re-report and the
        // server would re-acknowledge on every foreground, forever.
        const user = await makeUser();
        currentAccountId = obfuscatedPlayAccountId(user._id);

        installStub({ acknowledgementState: "ACKNOWLEDGEMENT_STATE_PENDING" });
        await subscriptionService.activateFromPlayPurchase(user._id, {
            purchaseToken: "token_ack_done",
            productId: MONTHLY_PRODUCT,
        });
        expect(playStub.acknowledge).toHaveBeenCalledTimes(1);

        // Google now reports it acknowledged. A fresh stub, so the count starts at zero.
        installStub({ acknowledgementState: PLAY_ACKNOWLEDGED });
        await subscriptionService.activateFromPlayPurchase(user._id, {
            purchaseToken: "token_ack_done",
            productId: MONTHLY_PRODUCT,
        });
        expect(playStub.acknowledge).not.toHaveBeenCalled();
    });

    it("expires the previous plan's credits when a new purchase replaces it", async () => {
        // closeCurrent retires the ROW; the credit ledger is separate and nothing else
        // zeroes it, so an upgrade used to hand the user the new plan's allowance stacked
        // on whatever the old plan left unspent. Same accumulation as the renewal path,
        // reached through a different door.
        const quarterlyProduct = PLAY_PRODUCTS[EPlanCode.QUARTERLY].productId;
        await subscriptionPlanModel.create({
            code: EPlanCode.QUARTERLY,
            displayName: "Quarterly",
            amountPaise: 279_900,
            durationDays: 90,
            credits: { expert: 3, careManager: 3 },
            playProductId: quarterlyProduct,
            playBasePlanId: PLAY_PRODUCTS[EPlanCode.QUARTERLY].basePlanId,
        });

        const user = await makeUser();
        currentAccountId = obfuscatedPlayAccountId(user._id);

        await subscriptionService.activateFromPlayPurchase(user._id, {
            purchaseToken: "token_monthly",
            productId: MONTHLY_PRODUCT,
        });
        expect(await creditService.getBalance(user._id, ECreditType.EXPERT)).toBe(1);

        installStub({
            lineItems: [
                { productId: quarterlyProduct, expiryTime: PLAY_EXPIRY.toISOString() },
            ],
        });
        await subscriptionService.activateFromPlayPurchase(user._id, {
            purchaseToken: "token_quarterly",
            productId: quarterlyProduct,
        });

        // The quarterly allowance, not the quarterly allowance plus the unspent monthly one.
        expect(await creditService.getBalance(user._id, ECreditType.EXPERT)).toBe(3);
        expect(await creditService.getBalance(user._id, ECreditType.CARE_MANAGER)).toBe(3);
    });

    it("does not expire the winner's row when a concurrent call verifies the same token", async () => {
        // One purchase reaches verify twice: the client's purchaseUpdatedListener and the
        // launch reconcile sweep both post the token. Both pass the top guard, and the
        // slower one used to reach closeCurrent *after* the faster one had inserted —
        // expiring the row it was about to be handed. The user paid, and their
        // subscription read "expired" twenty milliseconds after it was created.
        //
        // Delaying the second Play lookup pins that interleaving; a plain Promise.all
        // resolves both closeCurrent calls before either insert and never reproduces it.
        const user = await makeUser();
        currentAccountId = obfuscatedPlayAccountId(user._id);

        const payload = await playStub.getSubscription();
        let calls = 0;
        playStub.getSubscription.mockImplementation(async () => {
            if (calls++ > 0) await new Promise(resolve => setTimeout(resolve, 200));
            return payload as never;
        });

        const [first, second] = await Promise.all([
            subscriptionService.activateFromPlayPurchase(user._id, {
                purchaseToken: "token_race",
                productId: MONTHLY_PRODUCT,
            }),
            subscriptionService.activateFromPlayPurchase(user._id, {
                purchaseToken: "token_race",
                productId: MONTHLY_PRODUCT,
            }),
        ]);

        expect(String(second._id)).toBe(String(first._id));

        const rows = await subscriptionModel.find({ user_id: user._id }).lean();
        expect(rows).toHaveLength(1);
        expect(rows[0].status).toBe(ESubscriptionStatus.ACTIVE);
        expect(rows[0].isCurrent).toBe(true);
    });

    it("refuses a purchase token already claimed by another account", async () => {
        const alice = await makeUser();
        const bob = await makeUser();

        currentAccountId = obfuscatedPlayAccountId(alice._id);
        await subscriptionService.activateFromPlayPurchase(alice._id, {
            purchaseToken: "token_shared",
            productId: MONTHLY_PRODUCT,
        });

        await expect(
            subscriptionService.activateFromPlayPurchase(bob._id, {
                purchaseToken: "token_shared",
                productId: MONTHLY_PRODUCT,
            }),
        ).rejects.toMatchObject({ code: "PLAY_PURCHASE_ALREADY_CLAIMED" });
    });

    it("refuses a purchase whose obfuscated account id is not the caller's", async () => {
        // The endpoint is authenticated, so we know who is calling — but not who bought.
        // Without this check a purchase token lifted from another user could be redeemed
        // by whoever presents it first.
        const alice = await makeUser();
        const bob = await makeUser();
        currentAccountId = obfuscatedPlayAccountId(alice._id);

        await expect(
            subscriptionService.activateFromPlayPurchase(bob._id, {
                purchaseToken: "token_mismatch",
                productId: MONTHLY_PRODUCT,
            }),
        ).rejects.toMatchObject({ code: "PLAY_ACCOUNT_MISMATCH" });

        expect(await subscriptionModel.countDocuments({ user_id: bob._id })).toBe(0);
    });

    it("refuses a purchase carrying no obfuscated account id at all", async () => {
        const user = await makeUser();
        currentAccountId = obfuscatedPlayAccountId(user._id);
        installStub({ externalAccountIdentifiers: {} });

        await expect(
            subscriptionService.activateFromPlayPurchase(user._id, {
                purchaseToken: "token_no_account",
                productId: MONTHLY_PRODUCT,
            }),
        ).rejects.toMatchObject({ code: "PLAY_ACCOUNT_MISMATCH" });
    });

    it("errors on an unmapped product rather than falling back to a plan", async () => {
        // A mistyped id that silently resolved to the cheapest plan would grant the wrong
        // tier and the wrong credits, and nothing downstream would notice.
        const user = await makeUser();
        currentAccountId = obfuscatedPlayAccountId(user._id);
        installStub({
            lineItems: [
                {
                    productId: "vivamama_not_a_real_product",
                    expiryTime: PLAY_EXPIRY.toISOString(),
                },
            ],
        });

        await expect(
            subscriptionService.activateFromPlayPurchase(user._id, {
                purchaseToken: "token_unmapped",
                productId: "vivamama_not_a_real_product",
            }),
        ).rejects.toMatchObject({ code: "PLAY_PRODUCT_UNMAPPED" });

        expect(await subscriptionModel.countDocuments({ user_id: user._id })).toBe(0);
    });

    it("reports a pending purchase distinctly so the app can wait rather than error", async () => {
        // Common on UPI in India: the purchase exists but the money has not moved. The
        // eventual notification completes it.
        const user = await makeUser();
        currentAccountId = obfuscatedPlayAccountId(user._id);
        installStub({ subscriptionState: EPlaySubscriptionState.PENDING });

        await expect(
            subscriptionService.activateFromPlayPurchase(user._id, {
                purchaseToken: "token_pending",
                productId: MONTHLY_PRODUCT,
            }),
        ).rejects.toMatchObject({ code: "PLAY_PURCHASE_PENDING" });

        expect(await subscriptionModel.countDocuments({ user_id: user._id })).toBe(0);
    });

    it("refuses an expired purchase", async () => {
        const user = await makeUser();
        currentAccountId = obfuscatedPlayAccountId(user._id);
        installStub({ subscriptionState: EPlaySubscriptionState.EXPIRED });

        await expect(
            subscriptionService.activateFromPlayPurchase(user._id, {
                purchaseToken: "token_expired",
                productId: MONTHLY_PRODUCT,
            }),
        ).rejects.toMatchObject({ code: "PLAY_PURCHASE_NOT_ACTIVE" });
    });

    it("accepts a purchase in grace period — the user is still entitled", async () => {
        // Payment failed and Google is retrying; access must continue meanwhile.
        const user = await makeUser();
        currentAccountId = obfuscatedPlayAccountId(user._id);
        installStub({ subscriptionState: EPlaySubscriptionState.IN_GRACE_PERIOD });

        const sub = await subscriptionService.activateFromPlayPurchase(user._id, {
            purchaseToken: "token_grace",
            productId: MONTHLY_PRODUCT,
        });
        expect(sub.status).toBe(ESubscriptionStatus.ACTIVE);
    });

    it("ends a running trial instead of stacking a second live row", async () => {
        const user = await makeUser();
        currentAccountId = obfuscatedPlayAccountId(user._id);

        await subscriptionService.startTrial(user._id);
        await subscriptionService.activateFromPlayPurchase(user._id, {
            purchaseToken: "token_from_trial",
            productId: MONTHLY_PRODUCT,
        });

        const live = await subscriptionModel.find({ user_id: user._id, isCurrent: true }).lean();
        expect(live).toHaveLength(1);
        expect(live[0].tier).toBe(ESubscriptionTier.PREMIUM);
        expect(live[0].billingMode).toBe(EBillingMode.PLAY);
    });

    it("resolves the buyer to PREMIUM through the entitlement layer", async () => {
        // The activation is only worth anything if the rest of the app sees it, and the
        // entitlement layer re-derives tier from dates rather than reading status.
        const user = await makeUser();
        currentAccountId = obfuscatedPlayAccountId(user._id);

        await subscriptionService.activateFromPlayPurchase(user._id, {
            purchaseToken: "token_entitled",
            productId: MONTHLY_PRODUCT,
        });

        const entitlements = await entitlementService.getEntitlements(user._id);
        expect(entitlements.tier).toBe(ESubscriptionTier.PREMIUM);
    });
});

describe("cancel on the Play rail", () => {
    it("keeps access to the Play expiry date and calls the provider", async () => {
        const user = await makeUser();
        currentAccountId = obfuscatedPlayAccountId(user._id);

        await subscriptionService.activateFromPlayPurchase(user._id, {
            purchaseToken: "token_cancel",
            productId: MONTHLY_PRODUCT,
        });

        const cancelled = await subscriptionService.cancel(user._id);

        expect(cancelled.status).toBe(ESubscriptionStatus.CANCELLED);
        expect(cancelled.currentPeriodEnd!.toISOString()).toBe(PLAY_EXPIRY.toISOString());
        expect(playStub.cancel).toHaveBeenCalled();

        // Still PREMIUM: cancelling stops renewal, it does not revoke the paid period.
        const entitlements = await entitlementService.getEntitlements(user._id);
        expect(entitlements.tier).toBe(ESubscriptionTier.PREMIUM);
    });
});

describe("obfuscatedPlayAccountId", () => {
    it("is stable per user and different across users", async () => {
        const a = await makeUser();
        const b = await makeUser();

        expect(obfuscatedPlayAccountId(a._id)).toBe(obfuscatedPlayAccountId(a._id));
        expect(obfuscatedPlayAccountId(a._id)).not.toBe(obfuscatedPlayAccountId(b._id));
    });

    it("does not contain the user id, and fits Google's 64-character limit", async () => {
        const user = await makeUser();
        const id = obfuscatedPlayAccountId(user._id);

        expect(id).not.toContain(String(user._id));
        expect(id).toHaveLength(64);
    });
});
