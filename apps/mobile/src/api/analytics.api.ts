import { ANALYTICS_EVENTS } from '../constants/endpoints';
import { Capability } from '../types/entitlements.types';
import apiClientInterceptor from './apiClientInterceptor';

/**
 * The two funnel events with no server-side trace: a paywall being seen, and its CTA
 * being tapped. Everything else is recorded where it happens on the server.
 */
export enum AnalyticsEvent {
  PAYWALL_SHOWN = 'paywall.shown',
  PAYWALL_CTA_TAPPED = 'paywall.cta_tapped',
}

/**
 * Fire-and-forget. Analytics must never be able to break, block or slow a user action,
 * so failures are swallowed rather than surfaced — a missing funnel row costs less than
 * a paywall that fails to open.
 *
 * `tier` is deliberately not sent; the server resolves it, since the client's copy can
 * be stale and a wrong tier corrupts every segment of the funnel.
 */
export const trackEvent = (
  event: AnalyticsEvent,
  capability?: Capability,
  metadata?: Record<string, unknown>,
): void => {
  apiClientInterceptor()
    .post(ANALYTICS_EVENTS, { event, capability, metadata })
    .catch(() => {
      // Intentionally silent.
    });
};
