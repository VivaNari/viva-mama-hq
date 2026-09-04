import { DenialPayload } from '../types/entitlements.types';

/**
 * Bridge between the non-React axios interceptor and SubscriptionContext.
 *
 * Mirrors authEventHandler: the axios instance is a module-level singleton and cannot
 * use hooks, so the provider registers a handler here on mount and the interceptor
 * triggers it when the backend answers 402.
 */
type PaywallHandler = (denial: DenialPayload) => void;

let handler: PaywallHandler | null = null;

export const setPaywallHandler = (fn: PaywallHandler | null) => {
  handler = fn;
};

export const triggerPaywall = (denial: DenialPayload) => {
  handler?.(denial);
};
