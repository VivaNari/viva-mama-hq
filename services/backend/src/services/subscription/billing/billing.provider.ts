import {
    EBillingMode,
    EBillingProvider,
    ISubscription,
    ISubscriptionPlan,
} from "../../../types/subscription.types";

/**
 * The seam between the subscription state machine and the payment rail.
 *
 * Everything above this interface — tiers, entitlements, credits, the lifecycle job and
 * every app screen — is written against it, so switching from MANUAL (one-time Razorpay
 * Orders) to AUTOPAY (Razorpay Subscriptions with a saved-card mandate) adds a second
 * implementation rather than a rewrite.
 *
 * Pick the implementation with `getBillingProvider()`, and for anything acting on an
 * EXISTING subscription pass that row's own `billingMode` — never the current env value.
 * A user who started a MANUAL trial has no mandate on file, and must not be auto-charged
 * just because the toggle was flipped after they signed up.
 */

/** What starting a trial produced on the provider side. Empty under MANUAL. */
export interface ITrialHandle {
    providerSubscriptionId: string | null;
    mandateStatus: string | null;
}

/** What the client needs to open the provider's checkout sheet. */
export interface ICheckoutPayload {
    /** Razorpay order id (MANUAL) or subscription id (AUTOPAY). */
    providerOrderId: string;
    amountPaise: number;
    currency: string;
    /** Publishable key — safe to send to the client. */
    providerKeyId: string;
}

/** The client's post-payment callback, handed back for verification. */
export interface IVerificationInput {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
}

export interface IVerifiedActivation {
    providerOrderId: string;
    providerPaymentId: string;
}

export interface IBillingProvider {
    readonly mode: EBillingMode;
    readonly name: EBillingProvider;

    /**
     * MANUAL: a no-op — the trial carries no payment instrument.
     * AUTOPAY: creates the mandate whose first charge lands on day 7.
     */
    startTrial(userId: string, plan: ISubscriptionPlan | null): Promise<ITrialHandle>;

    /**
     * The amount comes from `plan`, never from the caller. The legacy endpoint takes
     * `amount` from the request body, which lets a client buy a ₹1,499 plan for ₹1.
     */
    createCheckout(userId: string, plan: ISubscriptionPlan): Promise<ICheckoutPayload>;

    /** Throws if the signature does not verify. */
    verify(input: IVerificationInput): Promise<IVerifiedActivation>;

    /**
     * Ask the provider directly whether an order has been paid, without a client-supplied
     * signature. Used to reconcile a payment that was captured but whose client callback
     * never fired — the react-native SDK can reject after a captured UPI payment, which
     * would otherwise leave a paid order permanently un-activated.
     *
     * Optional: only the Orders rail needs it. AUTOPAY reconciles through webhooks.
     */
    fetchPaidPayment?(orderId: string): Promise<{ paid: boolean; paymentId: string | null }>;

    cancel(subscription: ISubscription): Promise<void>;
}
