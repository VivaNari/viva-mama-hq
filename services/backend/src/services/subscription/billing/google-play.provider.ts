import { JWT } from "google-auth-library";

import env from "../../../config/env";
import { EBillingMode, EBillingProvider, ISubscription } from "../../../types/subscription.types";
import { IBillingProvider, ITrialHandle } from "./billing.provider";
import { PLAY_PRODUCTS } from "./play-products";

const ANDROID_PUBLISHER_SCOPE = "https://www.googleapis.com/auth/androidpublisher";
const API_ROOT = "https://androidpublisher.googleapis.com/androidpublisher/v3/applications";

/**
 * `SubscriptionPurchaseV2.acknowledgementState` once Google has recorded delivery.
 *
 * Compared against rather than assumed: acknowledgement is the one Play call whose
 * omission costs money, so the decision to skip it must rest on what Google reports,
 * never on what this system believes it did earlier.
 */
export const PLAY_ACKNOWLEDGED = "ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED";

/** Plan code -> Play product id. Used by the cancel path, which needs the product in the URL. */
const PLAY_PRODUCT_ID_BY_PLAN: Record<string, string> = Object.fromEntries(
    Object.entries(PLAY_PRODUCTS).map(([code, p]) => [code, p.productId]),
);

/**
 * The subset of SubscriptionPurchaseV2 this codebase reads.
 *
 * Deliberately partial. Google adds fields freely and typing the whole payload would
 * mean editing this file every time they do, for no benefit — everything not listed here
 * is ignored on purpose.
 */
export interface IPlaySubscriptionPurchase {
    subscriptionState: EPlaySubscriptionState;
    startTime?: string;
    latestOrderId?: string;
    /** Present when this purchase replaced another (upgrade, downgrade, re-signup). */
    linkedPurchaseToken?: string;
    acknowledgementState?: string;
    /** Present only on a license tester's purchase. Handy in logs; never a grant. */
    testPurchase?: Record<string, never>;
    externalAccountIdentifiers?: {
        obfuscatedExternalAccountId?: string;
        obfuscatedExternalProfileId?: string;
    };
    lineItems: Array<{
        productId: string;
        /** RFC3339. The authority on when access ends. */
        expiryTime: string;
        offerDetails?: {
            basePlanId?: string;
            offerId?: string;
        };
        autoRenewingPlan?: {
            autoRenewEnabled?: boolean;
        };
    }>;
}

/** Values of SubscriptionPurchaseV2.subscriptionState. */
export enum EPlaySubscriptionState {
    UNSPECIFIED = "SUBSCRIPTION_STATE_UNSPECIFIED",
    /** Payment is being collected — common on UPI in India, and not yet an entitlement. */
    PENDING = "SUBSCRIPTION_STATE_PENDING",
    ACTIVE = "SUBSCRIPTION_STATE_ACTIVE",
    /** Payment failed, Google is retrying, and the user KEEPS access meanwhile. */
    IN_GRACE_PERIOD = "SUBSCRIPTION_STATE_IN_GRACE_PERIOD",
    /** Retries exhausted. Access has stopped but the subscription can still recover. */
    ON_HOLD = "SUBSCRIPTION_STATE_ON_HOLD",
    PAUSED = "SUBSCRIPTION_STATE_PAUSED",
    /** Auto-renew is off, but access runs to expiryTime. NOT the end of entitlement. */
    CANCELED = "SUBSCRIPTION_STATE_CANCELED",
    EXPIRED = "SUBSCRIPTION_STATE_EXPIRED",
}

/** The states in which a user is entitled to what they paid for. */
export const PLAY_ENTITLED_STATES: readonly EPlaySubscriptionState[] = [
    EPlaySubscriptionState.ACTIVE,
    EPlaySubscriptionState.IN_GRACE_PERIOD,
    // CANCELED belongs here for the same reason LIVE_STATUSES includes CANCELLED:
    // cancelling stops the next charge, it does not revoke the period already bought.
    EPlaySubscriptionState.CANCELED,
];

export class PlayApiError extends Error {
    constructor(
        public readonly code: string,
        message: string,
        public readonly status?: number,
    ) {
        super(message);
        this.name = "PlayApiError";
    }
}

/**
 * Google Play Billing.
 *
 * Only `cancel()` of IBillingProvider is meaningful here. The Play rail is not shaped
 * like the Razorpay ones — there is no server-created order to open a sheet against and
 * no signature to check — so purchase verification lives on this class's own methods and
 * is driven by SubscriptionService.activateFromPlayPurchase, not by `verify()`.
 *
 * It is still registered in getBillingProvider so that anything resolving a provider
 * from an existing row's billingMode keeps working: the lifecycle cron and, importantly,
 * account deletion, which must be able to stop billing a user who is being erased.
 */
export class GooglePlayProvider implements IBillingProvider {
    public readonly mode = EBillingMode.PLAY;
    public readonly name = EBillingProvider.GOOGLE_PLAY;

    private client: JWT | null = null;

    /**
     * Built on first use rather than in the constructor: getBillingProvider() caches
     * providers eagerly, and a missing key must fail the request that needs Play, not
     * boot of a server whose other rails are fine.
     */
    private getClient(): JWT {
        if (this.client) return this.client;

        const raw = env.PLAY_DEVELOPER_SA_KEY_JSON;
        if (!raw) {
            throw new PlayApiError("PLAY_NOT_CONFIGURED", "PLAY_DEVELOPER_SA_KEY_JSON is not set");
        }

        let key: { client_email?: string; private_key?: string };
        try {
            key = JSON.parse(raw);
        } catch {
            throw new PlayApiError(
                "PLAY_NOT_CONFIGURED",
                "PLAY_DEVELOPER_SA_KEY_JSON is not valid JSON",
            );
        }

        if (!key.client_email || !key.private_key) {
            throw new PlayApiError(
                "PLAY_NOT_CONFIGURED",
                "PLAY_DEVELOPER_SA_KEY_JSON is missing client_email or private_key",
            );
        }

        // The scope is the whole point. A token minted for cloud-platform — which is what
        // `gcloud auth print-access-token` hands out — is refused by this API with
        // ACCESS_TOKEN_SCOPE_INSUFFICIENT, an error that reads like a missing Play Console
        // grant and is not one.
        this.client = new JWT({
            email: key.client_email,
            key: key.private_key,
            scopes: [ANDROID_PUBLISHER_SCOPE],
        });
        return this.client;
    }

    private async request<T>(method: "GET" | "POST", url: string, body?: unknown): Promise<T> {
        try {
            // `data` is omitted entirely on GET. Node 20's undici rejects a GET carrying
            // any body — an empty object counts — with "Request with GET/HEAD method
            // cannot have body", which surfaces here as PLAY_API_ERROR with no status,
            // because there is no HTTP response to read one from. POST keeps `?? {}`:
            // acknowledge and cancel take no payload but do expect a JSON body.
            const res = await this.getClient().request<T>({
                url,
                method,
                ...(method === "GET" ? {} : { data: body ?? {} }),
            });
            return res.data;
        } catch (error: any) {
            if (error instanceof PlayApiError) throw error;

            const status: number | undefined = error?.response?.status;
            const detail: string =
                error?.response?.data?.error?.message ?? error?.message ?? "unknown error";

            // 404 is not a fault: Google returns it for a token that never existed, and
            // also for one that has aged out. Callers distinguish it from a real outage.
            if (status === 404) {
                throw new PlayApiError("PLAY_PURCHASE_NOT_FOUND", detail, status);
            }
            if (status === 401 || status === 403) {
                throw new PlayApiError(
                    "PLAY_AUTH_FAILED",
                    `Play Developer API rejected the service account: ${detail}`,
                    status,
                );
            }
            throw new PlayApiError("PLAY_API_ERROR", detail, status);
        }
    }

    /** The current truth about a purchase, straight from Google. */
    public async getSubscription(purchaseToken: string): Promise<IPlaySubscriptionPurchase> {
        const url =
            `${API_ROOT}/${env.PLAY_PACKAGE_NAME}` +
            `/purchases/subscriptionsv2/tokens/${encodeURIComponent(purchaseToken)}`;
        return this.request<IPlaySubscriptionPurchase>("GET", url);
    }

    /**
     * Tell Google the purchase was delivered.
     *
     * ⚠️ Google automatically REFUNDS and revokes any subscription left unacknowledged
     * for three days. This is the most expensive line in the integration to get wrong,
     * and the failure is silent: everything works, and then the money goes back.
     *
     * Called after the subscription row is committed, never before — acknowledging first
     * means a crash mid-activation leaves Google believing a purchase was delivered that
     * this system has no record of.
     */
    public async acknowledge(purchaseToken: string, productId: string): Promise<void> {
        const url =
            `${API_ROOT}/${env.PLAY_PACKAGE_NAME}` +
            `/purchases/subscriptions/${encodeURIComponent(productId)}` +
            `/tokens/${encodeURIComponent(purchaseToken)}:acknowledge`;
        await this.request<void>("POST", url);
    }

    /**
     * Cancel at the provider. Takes effect at the end of the paid period; Google does
     * not pro-rate, and access is retained until expiryTime either way.
     *
     * The app does NOT call this. A user cancelling does so in the Play subscription
     * centre, which is where Play requires the control to live, and the local row is
     * updated when the resulting notification arrives. This path exists for cancels with
     * no user present — account deletion being the one that matters, since erasing a
     * user must also stop charging them.
     */
    public async cancel(subscription: ISubscription): Promise<void> {
        const token = subscription.playPurchaseToken;
        const productId = subscription.planCode
            ? PLAY_PRODUCT_ID_BY_PLAN[subscription.planCode]
            : null;

        // Nothing to do rather than an error: a row with no token never completed a Play
        // purchase, and account deletion must not be blocked by it.
        if (!token || !productId) return;

        const url =
            `${API_ROOT}/${env.PLAY_PACKAGE_NAME}` +
            `/purchases/subscriptions/${encodeURIComponent(productId)}` +
            `/tokens/${encodeURIComponent(token)}:cancel`;

        try {
            await this.request<void>("POST", url);
        } catch (error) {
            // An already-cancelled or expired subscription answers 400/404. Both mean the
            // desired end state already holds, so neither should fail the caller.
            if (
                error instanceof PlayApiError &&
                (error.code === "PLAY_PURCHASE_NOT_FOUND" || error.status === 400)
            ) {
                return;
            }
            throw error;
        }
    }

    /** Play has no server-side trial to start; a free trial is an offer on a base plan. */
    public async startTrial(): Promise<ITrialHandle> {
        return { providerSubscriptionId: null, mandateStatus: null };
    }

    public async createCheckout(): Promise<never> {
        throw new PlayApiError(
            "RAIL_NOT_SUPPORTED",
            "Play purchases are started by the client through Google Play, not by the server",
        );
    }

    public async verify(): Promise<never> {
        throw new PlayApiError(
            "RAIL_NOT_SUPPORTED",
            "Play purchases are verified via SubscriptionService.activateFromPlayPurchase",
        );
    }
}
