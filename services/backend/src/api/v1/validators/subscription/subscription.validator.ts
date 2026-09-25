import Joi from "joi";
import { EPlanCode } from "../../../../types/subscription.types";

/**
 * Only the plan CODE is accepted. The amount is resolved from the catalog server-side —
 * the legacy /orders/create takes `amount` from the body, which lets a client buy a
 * ₹1,499 plan for ₹1. Any `amount` sent here is rejected outright rather than ignored,
 * so a client relying on the old contract fails loudly instead of silently underpaying.
 */
export const createCheckoutValidator = Joi.object({
    planCode: Joi.string()
        .valid(...Object.values(EPlanCode))
        .required(),
}).unknown(false);

export const verifyCheckoutValidator = Joi.object({
    razorpay_order_id: Joi.string().required(),
    razorpay_payment_id: Joi.string().required(),
    razorpay_signature: Joi.string().required(),
}).unknown(false);

/**
 * Reconcile only needs the order id — there is no client signature, because the whole
 * point is to recover the case where the client never received one. The server confirms
 * the payment with Razorpay directly.
 */
export const reconcileCheckoutValidator = Joi.object({
    razorpay_order_id: Joi.string().required(),
}).unknown(false);

/**
 * A Play purchase carries no amount, no plan code and no signature — the token is the
 * whole claim, and Google is the only party who can resolve it. `productId` is sent
 * alongside because the acknowledge endpoint needs it in its URL; it is NOT trusted for
 * anything else, since the plan is read from what Google returns for the token.
 *
 * The token is opaque and long. Bounded rather than unbounded so a malformed client
 * cannot post megabytes into a lookup.
 */
export const verifyPlayPurchaseValidator = Joi.object({
    purchaseToken: Joi.string().min(10).max(4096).required(),
    productId: Joi.string().max(255).required(),
}).unknown(false);
