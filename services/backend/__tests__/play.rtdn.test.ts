jest.mock(require.resolve("../src/config/firebase"), () => ({ __esModule: true, default: null }));
jest.mock(require.resolve("../src/config/redis.config"), () => ({ __esModule: true }));
jest.mock("razorpay", () =>
    jest.fn().mockImplementation(() => ({ orders: { create: jest.fn() } })),
);

import { connectTestDb, closeTestDb, clearTestDb } from "./helpers/db";
import subscriptionModel from "../src/models/subscription.model";
import subscriptionPlanModel from "../src/models/subscription-plan.model";
import webhookEventModel from "../src/models/webhook-event.model";
import UserModel from "../src/models/user.model";
import consultationCreditModel from "../src/models/consultation-credit.model";
import { subscriptionService } from "../src/services/subscription/subscription.service";
import { entitlementService } from "../src/services/entitlements/entitlement.service";
import { creditService } from "../src/services/entitlements/credit.service";
import {
    EPlayNotificationType,
    playRtdnService,
} from "../src/services/subscription/play-rtdn.service";
import {
    __setBillingProviderForTests,
    EPlaySubscriptionState,
    obfuscatedPlayAccountId,
    PLAY_PRODUCTS,
} from "../src/services/subscription/billing";
import {
    EBillingMode,
    EBillingProvider,
    ECreditReason,
    ECreditType,
    EPlanCode,
    ESubscriptionStatus,
    ESubscriptionTier,
} from "../src/types/subscription.types";

jest.setTimeout(120000);

const PRODUCT = PLAY_PRODUCTS[EPlanCode.MONTHLY].productId;
const BASE_PLAN = PLAY_PRODUCTS[EPlanCode.MONTHLY].basePlanId;
const TOKEN = "token_rtdn";

const day = 86_400_000;
const FIRST_EXPIRY = new Date(Date.now() + 30 * day);
const RENEWED_EXPIRY = new Date(Date.now() + 60 * day);
const THIRD_EXPIRY = new Date(Date.now() + 90 * day);

let currentAccountId = "";
/** Mutable so a test can change what Google "currently" reports before dispatching. */
let playState: Record<string, unknown> = {};
let playStub: any;

function installStub() {
    playStub = {
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
            latestOrderId: "GPA.0000",
            externalAccountIdentifiers: { obfuscatedExternalAccountId: currentAccountId },
            lineItems: [
                {
                    productId: PRODUCT,
                    expiryTime: FIRST_EXPIRY.toISOString(),
                    offerDetails: { basePlanId: BASE_PLAN },
                },
            ],
            ...playState,
        })),
    };
    __setBillingProviderForTests(EBillingMode.PLAY, playStub);
}

/** Wrap a notification the way Pub/Sub delivers it. */
function push(
    notification: Record<string, unknown>,
    messageId = `msg_${Math.random().toString(36).slice(2)}`,
) {
    return {
        message: {
            data: Buffer.from(JSON.stringify(notification)).toString("base64"),
            messageId,
        },
    };
}

function subscriptionNotification(notificationType: number, purchaseToken = TOKEN) {
    return {
        version: "1.0",
        packageName: "com.wellnessemporio.vivamama",
        eventTimeMillis: String(Date.now()),
        subscriptionNotification: {
            version: "1.0",
            notificationType,
            purchaseToken,
            subscriptionId: PRODUCT,
        },
    };
}

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
            playProductId: PRODUCT,
            playBasePlanId: BASE_PLAN,
        },
    ]);
}

/** A user with a live Play subscription on TOKEN. */
async function makeSubscribedUser() {
    const user = await makeUser();
    currentAccountId = obfuscatedPlayAccountId(user._id);
    await subscriptionService.activateFromPlayPurchase(user._id, {
        purchaseToken: TOKEN,
        productId: PRODUCT,
    });
    return user;
}

beforeAll(connectTestDb);

afterAll(async () => {
    __setBillingProviderForTests(EBillingMode.PLAY, null);
    await closeTestDb();
});

beforeEach(async () => {
    await clearTestDb();
    await seedPlans();
    playState = {};
    installStub();
});

describe("Play RTDN envelope handling", () => {
    it("ignores a body that is not a Pub/Sub push", async () => {
        expect(await playRtdnService.handle({} as any)).toEqual({ outcome: "MALFORMED" });
    });

    it("acknowledges undecodable data rather than failing", async () => {
        // A body that cannot be parsed will not become parseable on retry, so it must be
        // acknowledged. Returning non-2xx would have Pub/Sub redeliver it for days.
        const result = await playRtdnService.handle({
            message: { data: "not-base64-json", messageId: "m1" },
        });
        expect(result.outcome).toBe("MALFORMED");
    });

    it("acknowledges Play Console's test notification without a lookup", async () => {
        const result = await playRtdnService.handle(push({ testNotification: { version: "1.0" } }));
        expect(result.outcome).toBe("TEST");
        expect(playStub.getSubscription).not.toHaveBeenCalled();
    });

    it("is idempotent on the Pub/Sub message id", async () => {
        // Google redelivers the same message id, and two genuinely distinct renewals look
        // identical in the payload — same token, product and type. The message id is the
        // only thing that distinguishes a redelivery from a second event.
        await makeSubscribedUser();
        const envelope = push(subscriptionNotification(EPlayNotificationType.RENEWED), "msg_fixed");

        playState = {
            lineItems: [{ productId: PRODUCT, expiryTime: RENEWED_EXPIRY.toISOString() }],
        };
        installStub();

        expect((await playRtdnService.handle(envelope)).outcome).toBe("PROCESSED");
        expect((await playRtdnService.handle(envelope)).outcome).toBe("DUPLICATE");

        const credits = await consultationCreditModel
            .find({ type: ECreditType.EXPERT })
            .sort({ seq: 1 })
            .lean();
        // The purchase grant, then the renewal's expire-and-grant pair. The redelivery
        // adds nothing: a second renewal would show as another pair.
        expect(credits.map((c) => c.reason)).toEqual([
            ECreditReason.GRANT,
            ECreditReason.EXPIRE,
            ECreditReason.GRANT,
        ]);
        expect(credits[credits.length - 1].balanceAfter).toBe(1);
    });

    it("records every notification for audit, processed or not", async () => {
        await makeSubscribedUser();
        await playRtdnService.handle(
            push(subscriptionNotification(EPlayNotificationType.CANCELED), "msg_audit"),
        );

        const event = await webhookEventModel.findOne({ providerEventId: "play:msg_audit" }).lean();
        expect(event).toBeTruthy();
        expect(event!.provider).toBe(EBillingProvider.GOOGLE_PLAY);
        expect(event!.processedAt).toBeTruthy();
    });
});

describe("Play RTDN lifecycle", () => {
    it("extends the term and grants the next period's credits on renewal", async () => {
        const user = await makeSubscribedUser();

        playState = {
            lineItems: [{ productId: PRODUCT, expiryTime: RENEWED_EXPIRY.toISOString() }],
        };
        installStub();

        await playRtdnService.handle(push(subscriptionNotification(EPlayNotificationType.RENEWED)));

        const row = await subscriptionModel.findOne({ user_id: user._id }).lean();
        expect(row!.currentPeriodEnd!.toISOString()).toBe(RENEWED_EXPIRY.toISOString());
        expect(row!.status).toBe(ESubscriptionStatus.ACTIVE);

        // Per period, not cumulative. The outgoing term's unspent credit is expired on
        // the way in, so the balance returns to the plan's allowance instead of stacking
        // — one expert consultation a month means one a month, not twelve banked and
        // spent at once. Expire and grant are adjacent, so the user is never at zero.
        const credits = await consultationCreditModel
            .find({ user_id: user._id, type: ECreditType.EXPERT })
            .sort({ seq: 1 })
            .lean();
        expect(credits.map((c) => [c.reason, c.delta, c.balanceAfter])).toEqual([
            [ECreditReason.GRANT, 1, 1],
            [ECreditReason.EXPIRE, -1, 0],
            [ECreditReason.GRANT, 1, 1],
        ]);
    });

    it("does not let unspent credits accumulate across renewals", async () => {
        // The failure this prevents: a subscriber who never books banks a credit every
        // period and redeems the lot at once. Consultations carry a real fulfilment cost,
        // so the allowance has to be per period. Observed accumulating 1 -> 7 across seven
        // renewals on an accelerated licence-tester subscription.
        const user = await makeSubscribedUser();

        for (const expiry of [RENEWED_EXPIRY, THIRD_EXPIRY]) {
            playState = { lineItems: [{ productId: PRODUCT, expiryTime: expiry.toISOString() }] };
            installStub();
            await playRtdnService.handle(
                push(subscriptionNotification(EPlayNotificationType.RENEWED)),
            );
        }

        // Three terms paid for, one term's allowance in hand.
        expect(await creditService.getBalance(user._id, ECreditType.EXPERT)).toBe(1);
        expect(await creditService.getBalance(user._id, ECreditType.CARE_MANAGER)).toBe(1);
    });

    it("grants a full allowance on renewal even when the previous term was spent", async () => {
        // The other direction: expiring a bucket that is already at zero must be a no-op,
        // not an EXPIRE row that drives the balance negative or suppresses the grant.
        const user = await makeSubscribedUser();

        await creditService.consume({
            userId: user._id,
            subscriptionId: (await subscriptionModel.findOne({ user_id: user._id }).lean())!._id,
            type: ECreditType.EXPERT,
            expiresAt: FIRST_EXPIRY,
        });
        expect(await creditService.getBalance(user._id, ECreditType.EXPERT)).toBe(0);

        playState = {
            lineItems: [{ productId: PRODUCT, expiryTime: RENEWED_EXPIRY.toISOString() }],
        };
        installStub();
        await playRtdnService.handle(push(subscriptionNotification(EPlayNotificationType.RENEWED)));

        expect(await creditService.getBalance(user._id, ECreditType.EXPERT)).toBe(1);
    });

    it("advances the user snapshot on renewal, so access survives the first period end", async () => {
        // Regression. onRenewed wrote the subscriptions row directly and never refreshed
        // the denormalized user.subscription snapshot, which `resolveTier` reads and
        // nothing else. The row said ACTIVE with a term running 60 days out while the
        // snapshot still carried the 30-day date, so the user dropped to FREE at the end
        // of their FIRST period while Google went on charging them -- the exact failure
        // RTDN exists to prevent. Caught in production on an accelerated licence-tester
        // subscription, where one period is five minutes.
        const user = await makeSubscribedUser();

        playState = {
            lineItems: [{ productId: PRODUCT, expiryTime: RENEWED_EXPIRY.toISOString() }],
        };
        installStub();

        await playRtdnService.handle(push(subscriptionNotification(EPlayNotificationType.RENEWED)));

        const refreshed = await UserModel.findById(user._id).lean();
        expect(refreshed!.subscription!.currentPeriodEnd!.toISOString()).toBe(
            RENEWED_EXPIRY.toISOString(),
        );

        // Past the original term, inside the renewed one: where the bug used to bite.
        const afterFirstTerm = new Date(FIRST_EXPIRY.getTime() + day);
        expect(entitlementService.resolveTier(refreshed as any, afterFirstTerm)).toBe(
            ESubscriptionTier.PREMIUM,
        );
    });

    it("mirrors a cancellation onto the user snapshot", async () => {
        // Same class of bug as the renewal case: the row is the record, but the snapshot
        // is what every read goes through, so a status the snapshot never learns about
        // is a status the app never shows.
        const user = await makeSubscribedUser();

        await playRtdnService.handle(
            push(subscriptionNotification(EPlayNotificationType.CANCELED)),
        );

        const refreshed = await UserModel.findById(user._id).lean();
        expect(refreshed!.subscription!.status).toBe(ESubscriptionStatus.CANCELLED);
        // Still entitled: cancelling stops renewal, it does not revoke the paid term.
        expect(refreshed!.subscription!.tier).toBe(ESubscriptionTier.PREMIUM);
    });

    it("never shortens a term when an older renewal arrives late", async () => {
        // Notifications arrive out of order. Applying a stale one would cut short a term
        // the user has paid for.
        const user = await makeSubscribedUser();

        playState = {
            lineItems: [{ productId: PRODUCT, expiryTime: RENEWED_EXPIRY.toISOString() }],
        };
        installStub();
        await playRtdnService.handle(push(subscriptionNotification(EPlayNotificationType.RENEWED)));

        // Now Google reports the OLD expiry, as a delayed duplicate would.
        playState = {
            lineItems: [{ productId: PRODUCT, expiryTime: FIRST_EXPIRY.toISOString() }],
        };
        installStub();
        await playRtdnService.handle(push(subscriptionNotification(EPlayNotificationType.RENEWED)));

        const row = await subscriptionModel.findOne({ user_id: user._id }).lean();
        expect(row!.currentPeriodEnd!.toISOString()).toBe(RENEWED_EXPIRY.toISOString());
    });

    it("marks cancelled without touching the access date", async () => {
        // The promise the whole cancel flow makes: stopping renewal does not revoke the
        // period already paid for.
        const user = await makeSubscribedUser();

        await playRtdnService.handle(
            push(subscriptionNotification(EPlayNotificationType.CANCELED)),
        );

        const row = await subscriptionModel.findOne({ user_id: user._id }).lean();
        expect(row!.status).toBe(ESubscriptionStatus.CANCELLED);
        expect(row!.currentPeriodEnd!.toISOString()).toBe(FIRST_EXPIRY.toISOString());

        const entitlements = await entitlementService.getEntitlements(user._id);
        expect(entitlements.tier).toBe(ESubscriptionTier.PREMIUM);
    });

    it("keeps access during a grace period", async () => {
        const user = await makeSubscribedUser();

        await playRtdnService.handle(
            push(subscriptionNotification(EPlayNotificationType.IN_GRACE_PERIOD)),
        );

        const row = await subscriptionModel.findOne({ user_id: user._id }).lean();
        expect(row!.status).toBe(ESubscriptionStatus.HALTED);
        expect(row!.currentPeriodEnd!.toISOString()).toBe(FIRST_EXPIRY.toISOString());

        const entitlements = await entitlementService.getEntitlements(user._id);
        expect(entitlements.tier).toBe(ESubscriptionTier.PREMIUM);
    });

    it("expires on EXPIRED and drops the user to FREE", async () => {
        const user = await makeSubscribedUser();

        // Google reports the terminal state alongside the notification. The stub's
        // default is ACTIVE, which would be a contradiction -- see the stale-EXPIRED
        // test below, which is the case that contradiction actually describes.
        playState = { subscriptionState: EPlaySubscriptionState.EXPIRED };
        installStub();

        await playRtdnService.handle(push(subscriptionNotification(EPlayNotificationType.EXPIRED)));

        const row = await subscriptionModel.findOne({ user_id: user._id }).lean();
        expect(row!.status).toBe(ESubscriptionStatus.EXPIRED);
        expect(row!.isCurrent).toBe(false);

        const entitlements = await entitlementService.getEntitlements(user._id);
        expect(entitlements.tier).toBe(ESubscriptionTier.FREE);
    });

    it("ignores a stale EXPIRED for a purchase Google still reports as entitled", async () => {
        // A renewal is delivered as two messages -- the old term ending and the new one
        // beginning -- and they are not ordered. Observed on a license tester: EXPIRED
        // arrived six seconds BEFORE the RENEWED that revived the row. Reversed, an
        // unguarded expire revokes a live, paid subscription, and nothing restores it
        // until the following renewal.
        const user = await makeSubscribedUser();

        playState = {
            subscriptionState: EPlaySubscriptionState.ACTIVE,
            lineItems: [{ productId: PRODUCT, expiryTime: RENEWED_EXPIRY.toISOString() }],
        };
        installStub();
        await playRtdnService.handle(push(subscriptionNotification(EPlayNotificationType.RENEWED)));

        // The late EXPIRED for the term that just ended. Google still says ACTIVE.
        const { outcome } = await playRtdnService.handle(
            push(subscriptionNotification(EPlayNotificationType.EXPIRED)),
        );

        expect(outcome).toBe("IGNORED");

        const row = await subscriptionModel.findOne({ user_id: user._id }).lean();
        expect(row!.status).toBe(ESubscriptionStatus.ACTIVE);
        expect(row!.isCurrent).toBe(true);
        expect(row!.currentPeriodEnd!.toISOString()).toBe(RENEWED_EXPIRY.toISOString());

        const entitlements = await entitlementService.getEntitlements(user._id);
        expect(entitlements.tier).toBe(ESubscriptionTier.PREMIUM);
    });

    it("still revokes on REVOKED even while Google reports an entitled state", async () => {
        // REVOKED is Google taking the entitlement back -- a refund or chargeback -- and
        // must not inherit the EXPIRED guard, or a refunded user keeps access.
        const user = await makeSubscribedUser();

        playState = { subscriptionState: EPlaySubscriptionState.ACTIVE };
        installStub();

        await playRtdnService.handle(push(subscriptionNotification(EPlayNotificationType.REVOKED)));

        const row = await subscriptionModel.findOne({ user_id: user._id }).lean();
        expect(row!.status).toBe(ESubscriptionStatus.EXPIRED);
        expect(row!.isCurrent).toBe(false);

        const entitlements = await entitlementService.getEntitlements(user._id);
        expect(entitlements.tier).toBe(ESubscriptionTier.FREE);
    });

    it("revokes access immediately on a voided purchase, ignoring the paid-to date", async () => {
        // A refund or chargeback. The money has gone back, so the entitlement goes with
        // it — waiting for currentPeriodEnd would give away a month for free.
        const user = await makeSubscribedUser();

        await playRtdnService.handle(
            push({
                version: "1.0",
                packageName: "com.wellnessemporio.vivamama",
                voidedPurchaseNotification: { purchaseToken: TOKEN, orderId: "GPA.0000" },
            }),
        );

        const entitlements = await entitlementService.getEntitlements(user._id);
        expect(entitlements.tier).toBe(ESubscriptionTier.FREE);
    });

    it("acknowledges a notification for a purchase token it has no row for", async () => {
        const result = await playRtdnService.handle(
            push(subscriptionNotification(EPlayNotificationType.CANCELED, "token_unknown")),
        );
        expect(result.outcome).toBe("UNKNOWN_SUBSCRIPTION");
    });

    it("recovers a plan change whose client verify never landed, via linkedPurchaseToken", async () => {
        // Google issues a NEW token on a plan change and points it at the one it
        // replaced. If the client never reported the new token -- killed app, lost
        // network -- the purchase is unattributable: the obfuscated account id on it is
        // an HMAC and cannot be reversed. The predecessor row is the only thread back to
        // a user, and without following it the user pays and gets nothing.
        const user = await makeSubscribedUser();
        const NEW_TOKEN = "token_after_plan_change";

        playState = {
            subscriptionState: EPlaySubscriptionState.ACTIVE,
            linkedPurchaseToken: TOKEN,
            lineItems: [{ productId: PRODUCT, expiryTime: RENEWED_EXPIRY.toISOString() }],
        };
        installStub();

        const { outcome } = await playRtdnService.handle(
            push(subscriptionNotification(EPlayNotificationType.PURCHASED, NEW_TOKEN)),
        );

        expect(outcome).toBe("PROCESSED");

        const row = await subscriptionModel
            .findOne({ playPurchaseToken: NEW_TOKEN, isCurrent: true })
            .lean();
        expect(row).not.toBeNull();
        expect(String(row!.user_id)).toBe(String(user._id));

        const entitlements = await entitlementService.getEntitlements(user._id);
        expect(entitlements.tier).toBe(ESubscriptionTier.PREMIUM);
    });

    it("does not attribute a linked purchase whose predecessor belongs to nobody", async () => {
        // The link only nominates a candidate. With no predecessor row there is no user
        // to attribute to, and guessing is not an option.
        playState = {
            subscriptionState: EPlaySubscriptionState.ACTIVE,
            linkedPurchaseToken: "token_that_was_never_seen",
        };
        installStub();

        const { outcome } = await playRtdnService.handle(
            push(subscriptionNotification(EPlayNotificationType.PURCHASED, "token_orphan")),
        );

        expect(outcome).toBe("UNKNOWN_SUBSCRIPTION");
    });

    it("ignores notification types with no entitlement consequence", async () => {
        await makeSubscribedUser();
        const result = await playRtdnService.handle(
            push(subscriptionNotification(EPlayNotificationType.PRICE_CHANGE_CONFIRMED)),
        );
        expect(result.outcome).toBe("IGNORED");
    });

    it("re-reads state from Google rather than trusting the notification body", async () => {
        // Notifications arrive out of order and can be redelivered minutes later, so the
        // body may already be stale. Re-reading is what makes ordering irrelevant.
        await makeSubscribedUser();
        playStub.getSubscription.mockClear();

        await playRtdnService.handle(push(subscriptionNotification(EPlayNotificationType.RENEWED)));

        expect(playStub.getSubscription).toHaveBeenCalledWith(TOKEN);
    });
});
