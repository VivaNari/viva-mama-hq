/**
 * Firebase Analytics + Crashlytics, for the rest of the app.
 *
 * Import from here and nowhere else — `client.ts` is the only module allowed to
 * touch `@react-native-firebase/*` directly.
 *
 * Deliberately independent of `api/analytics.api.ts`: that pipeline owns the
 * server-side entitlement funnel and resolves `tier` itself. The two do not know
 * about each other, and an event existing in both is fine.
 */
export {
  track,
  trackScreen,
  identify,
  clearIdentity,
  setUserProps,
  recordError,
  breadcrumb,
  setKey,
  triggerCrash,
} from './client';

export {
  AnalyticsEvent,
  lengthBucket,
  latencyBucket,
  dwellBucket,
  toBucket,
  toAnalyticsConsultationType,
} from './events';

export type {
  AnalyticsEventName,
  AnalyticsItem,
  AuthMethod,
  ConsultationType,
  EventParams,
  NotificationSource,
  PaymentMode,
  SizeBucket,
} from './events';

export { UserProperty, resolveOnboardingStage } from './properties';

export type {
  OnboardingStage,
  UserProperties,
  UserPropertyName,
} from './properties';
