import env from "../../../config/env";
import { EBillingMode } from "../../../types/subscription.types";
import { IBillingProvider } from "./billing.provider";
import { GooglePlayProvider } from "./google-play.provider";
import { RazorpayOrdersProvider } from "./razorpay-orders.provider";
import { RazorpaySubscriptionsProvider } from "./razorpay-subscriptions.provider";

export * from "./billing.provider";
export * from "./google-play.provider";
export * from "./play-account-id";
export * from "./play-products";
export { GooglePlayProvider, RazorpayOrdersProvider, RazorpaySubscriptionsProvider };

const providers = new Map<EBillingMode, IBillingProvider>();

/**
 * Resolve the provider for a billing mode.
 *
 * Callers acting on an EXISTING subscription must pass that row's `billingMode`; only
 * the creation of a NEW subscription reads the env default. Reading the env at decision
 * time would try to auto-charge trials that were started with no mandate on file the
 * moment the toggle is flipped.
 */
export function getBillingProvider(mode: EBillingMode = env.BILLING_MODE): IBillingProvider {
    const cached = providers.get(mode);
    if (cached) return cached;

    let provider: IBillingProvider;
    switch (mode) {
        case EBillingMode.MANUAL:
            provider = new RazorpayOrdersProvider();
            break;
        case EBillingMode.AUTOPAY:
            provider = new RazorpaySubscriptionsProvider();
            break;
        // Registered even though the app never asks it to create a checkout: the
        // lifecycle cron and account deletion both resolve a provider from an existing
        // row's billingMode, and a PLAY row must not make them throw.
        case EBillingMode.PLAY:
            provider = new GooglePlayProvider();
            break;
        default:
            throw new Error(`Unknown billing mode: ${mode}`);
    }

    providers.set(mode, provider);
    return provider;
}

/** Test seam — lets a suite install a stub without reaching into the module cache. */
export function __setBillingProviderForTests(
    mode: EBillingMode,
    provider: IBillingProvider | null,
): void {
    if (provider) providers.set(mode, provider);
    else providers.delete(mode);
}
