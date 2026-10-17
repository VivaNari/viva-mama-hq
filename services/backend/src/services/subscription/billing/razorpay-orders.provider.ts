import crypto from "crypto";
import Razorpay from "razorpay";

import env from "../../../config/env";
import {
    EBillingMode,
    EBillingProvider,
    ISubscription,
    ISubscriptionPlan,
} from "../../../types/subscription.types";
import {
    IBillingProvider,
    ICheckoutPayload,
    ITrialHandle,
    IVerificationInput,
    IVerifiedActivation,
} from "./billing.provider";

/**
 * MANUAL mode — one-time Razorpay Orders.
 *
 * No card is stored and no mandate exists, so the trial starts without payment details
 * and nothing can be charged automatically when it ends. The lifecycle job drops the
 * user to FREE on day 7 and the app shows the paywall; buying is an explicit action
 * every term.
 */
export class RazorpayOrdersProvider implements IBillingProvider {
    public readonly mode = EBillingMode.MANUAL;
    public readonly name = EBillingProvider.RAZORPAY_ORDERS;

    private razorpay: Razorpay;

    constructor() {
        this.razorpay = new Razorpay({
            key_id: env.RAZORPAY_API_KEY as string,
            key_secret: env.RAZORPAY_SECRET_KEY as string,
        });
    }

    /**
     * Nothing to do: on the Orders rail there is no token to charge against later.
     * Storing a card and auto-debiting on day 7 requires the Recurring API, which is
     * what AUTOPAY mode is for.
     */
    public async startTrial(): Promise<ITrialHandle> {
        return { providerSubscriptionId: null, mandateStatus: null };
    }

    public async createCheckout(
        userId: string,
        plan: ISubscriptionPlan,
    ): Promise<ICheckoutPayload> {
        const order = await this.razorpay.orders.create({
            // Already paise — the catalog stores integer paise precisely so no float
            // rounding can reach the gateway. The legacy path multiplied a rupee amount
            // by 100 here, which is also where the client-supplied amount got in.
            amount: plan.amountPaise,
            currency: "INR",
            receipt: `sub_${plan.code}_${Date.now()}`,
            notes: { userId, planCode: plan.code },
        });

        return {
            providerOrderId: order.id,
            amountPaise: plan.amountPaise,
            currency: "INR",
            providerKeyId: env.RAZORPAY_API_KEY as string,
        };
    }

    public async verify(input: IVerificationInput): Promise<IVerifiedActivation> {
        const expected = crypto
            .createHmac("sha256", env.RAZORPAY_SECRET_KEY as string)
            .update(`${input.razorpay_order_id}|${input.razorpay_payment_id}`)
            .digest("hex");

        // timingSafeEqual over a plain !== so the comparison cannot be probed byte by
        // byte. It throws on a length mismatch, hence the guard.
        const expectedBuf = Buffer.from(expected, "utf8");
        const actualBuf = Buffer.from(input.razorpay_signature ?? "", "utf8");
        const matches =
            expectedBuf.length === actualBuf.length &&
            crypto.timingSafeEqual(expectedBuf, actualBuf);

        if (!matches) {
            throw new Error("PAYMENT_SIGNATURE_INVALID");
        }

        return {
            providerOrderId: input.razorpay_order_id,
            providerPaymentId: input.razorpay_payment_id,
        };
    }

    /**
     * The source of truth for "did this order actually get paid", asked of Razorpay
     * rather than the client. An order flips to `paid` only once its payment is
     * captured, so this is safe to trust without a signature.
     */
    public async fetchPaidPayment(
        orderId: string,
    ): Promise<{ paid: boolean; paymentId: string | null }> {
        const order = await this.razorpay.orders.fetch(orderId);
        if (order.status !== "paid") {
            return { paid: false, paymentId: null };
        }

        // Find the captured payment on the order to record its id.
        const payments = await this.razorpay.orders.fetchPayments(orderId);
        const captured = (payments.items ?? []).find((p: any) => p.status === "captured");
        return { paid: true, paymentId: captured?.id ?? null };
    }

    /**
     * Nothing to cancel at the provider: a one-time order has no recurring mandate.
     * The subscription row is marked cancelled locally and access runs to period end.
     */
    public async cancel(_subscription: ISubscription): Promise<void> {
        return;
    }
}
