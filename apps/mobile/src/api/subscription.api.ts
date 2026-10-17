import {
  SUBSCRIPTION_CANCEL,
  SUBSCRIPTION_CHECKOUT_CREATE,
  SUBSCRIPTION_CHECKOUT_RECONCILE,
  SUBSCRIPTION_CHECKOUT_VERIFY,
  SUBSCRIPTION_FREE_SELECT,
  SUBSCRIPTION_ME,
  SUBSCRIPTION_PLANS,
  SUBSCRIPTION_PLAY_VERIFY,
  SUBSCRIPTION_TRIAL_START,
} from '../constants/endpoints';
import { Entitlements, PlanCode, SubscriptionPlan } from '../types/entitlements.types';
import apiClientInterceptor from './apiClientInterceptor';

export const getEntitlements = async (): Promise<Entitlements> =>
  (await apiClientInterceptor().get(SUBSCRIPTION_ME)).data.data;

export const getSubscriptionPlans = async (): Promise<SubscriptionPlan[]> =>
  (await apiClientInterceptor().get(SUBSCRIPTION_PLANS)).data.data;

export const startFreeTrial = async () =>
  (await apiClientInterceptor().post(SUBSCRIPTION_TRIAL_START)).data.data;

export const selectFreePlan = async (): Promise<Entitlements> =>
  (await apiClientInterceptor().post(SUBSCRIPTION_FREE_SELECT)).data.data;

/**
 * Only the plan code is sent. The server rejects an `amount` outright rather than
 * ignoring it, so there is no way for the client to influence what is charged.
 */
export const createCheckout = async (
  planCode: PlanCode,
): Promise<{
  providerOrderId: string;
  amountPaise: number;
  currency: string;
  providerKeyId: string;
  planCode: PlanCode;
}> =>
  (await apiClientInterceptor().post(SUBSCRIPTION_CHECKOUT_CREATE, { planCode })).data
    .data;

export const verifyCheckout = async (payload: {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}): Promise<{ entitlements: Entitlements }> =>
  (await apiClientInterceptor().post(SUBSCRIPTION_CHECKOUT_VERIFY, payload)).data.data;

/**
 * Ask the server to confirm a payment with Razorpay directly and activate if it went
 * through. Used when the checkout sheet errors AFTER the payment was actually captured —
 * a react-native-razorpay quirk on UPI — so a real payment is never silently lost.
 */
export const reconcileCheckout = async (
  razorpay_order_id: string,
): Promise<{ activated: boolean; entitlements: Entitlements }> =>
  (await apiClientInterceptor().post(SUBSCRIPTION_CHECKOUT_RECONCILE, { razorpay_order_id }))
    .data.data;

/**
 * Redeem a Google Play purchase.
 *
 * There is no create step to pair with this: the purchase begins and completes inside
 * Google Play, and the server first hears about it here. The token is the whole claim —
 * only Google can say what it bought, which is exactly why this cannot be decided on the
 * client.
 *
 * Safe to retry. The server is idempotent on the purchase token, so a call that timed
 * out after the server committed returns the same subscription rather than a second one.
 */
export const verifyPlayPurchase = async (payload: {
  purchaseToken: string;
  productId: string;
}): Promise<{ entitlements: Entitlements }> =>
  (await apiClientInterceptor().post(SUBSCRIPTION_PLAY_VERIFY, payload)).data.data;

/**
 * Cancel the current subscription. Access continues to the end of the paid period —
 * cancelling stops renewal, it does not revoke what was already paid for.
 *
 * Idempotent: cancelling an already-cancelled subscription succeeds and returns the same
 * date, so a retry after a network error needs no special case. Answers 404 when there is
 * no subscription to cancel.
 *
 * The server also returns the full subscription row. It is deliberately left off this
 * type: `GET /subscription/me` is where the rest of the app reads tier and status from,
 * and a second source of truth for the same facts is how the two drift apart.
 */
export const cancelSubscription = async (): Promise<{ accessUntil: string | null }> =>
  (await apiClientInterceptor().post(SUBSCRIPTION_CANCEL)).data.data;
