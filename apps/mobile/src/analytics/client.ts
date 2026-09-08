/**
 * The only module that touches the Firebase SDKs directly.
 *
 * Everything else in the app imports from `src/analytics` and never sees
 * `@react-native-firebase/*`, so the SDK surface, the swallow-all error
 * handling and the analytics/Crashlytics pairing all live in one place.
 *
 * Two behaviours are deliberately built in here rather than left to call sites:
 *
 *  1. Every tracked event and screen view also writes a Crashlytics breadcrumb.
 *     One call at the call site, and every crash report arrives carrying the
 *     user's preceding action trail for free.
 *
 *  2. Nothing here can throw into a user action. Analytics failing must never be
 *     able to break, block or slow down what the user was actually doing — the
 *     same principle `api/analytics.api.ts` already applies to the server
 *     pipeline. A missing event costs far less than a broken screen.
 */
import {
  getAnalytics,
  logEvent as fireLogEvent,
  logScreenView as fireLogScreenView,
  setUserId as fireSetAnalyticsUserId,
  setUserProperties as fireSetUserProperties,
} from '@react-native-firebase/analytics';
import {
  getCrashlytics,
  crash as fireCrash,
  log as fireLogCrash,
  recordError as fireRecordError,
  setAttribute as fireSetAttribute,
  setAttributes as fireSetAttributes,
  setUserId as fireSetCrashlyticsUserId,
} from '@react-native-firebase/crashlytics';

import { AnalyticsEventName, EventParams } from './events';
import { UserProperties, UserPropertyName } from './properties';

/**
 * Constructing the Crashlytics module installs two global handlers for us, in
 * its constructor (see @react-native-firebase/crashlytics/lib/index.js):
 *
 *   - `ErrorUtils.setGlobalHandler` — uncaught fatal JS errors.
 *   - `rejection-tracking.enable({ allRejections: true })` — unhandled promise
 *     rejections, recorded as non-fatals, and deliberately no-op in __DEV__ so
 *     React Native's own dev-mode rejection warnings still work.
 *
 * Do NOT install either of these in app code. `rejection-tracking.enable`
 * *replaces* the active handler rather than chaining, so a second call would
 * silently disable the SDK's reporting.
 */
const analytics = getAnalytics();
const crashlytics = getCrashlytics();

/**
 * `logEvent` ships one overload per GA4 recommended name plus a generic one that
 * explicitly excludes those names (`CustomEventName<T> = T extends
 * EventNameString ? never : T`). TypeScript cannot resolve a *union* of names —
 * which is exactly what `AnalyticsEventName` is — against that overload set, so
 * the call site below is narrowed to the underlying runtime signature.
 *
 * Nothing is lost: `EventParams` in ./events already constrains every name to
 * its own parameter shape, and does so more tightly than the SDK overloads do.
 * The runtime reserved-name check inside the SDK still applies, and none of our
 * names are on that list.
 */
type LogEventFn = (
  instance: typeof analytics,
  name: string,
  params?: Record<string, unknown>,
) => Promise<void>;

const logEventUnchecked = fireLogEvent as unknown as LogEventFn;

/**
 * Run an SDK call, swallowing anything it throws.
 *
 * In dev the failure is surfaced on the console so instrumentation bugs are
 * visible while building; in release it is silent by design.
 */
const safely = (label: string, fn: () => unknown): void => {
  try {
    const result = fn();
    // Most of these SDK calls return a promise. An unhandled rejection from a
    // fire-and-forget analytics call would otherwise reach the global handler
    // and be reported as though it were a real app fault.
    if (result && typeof (result as Promise<unknown>).catch === 'function') {
      (result as Promise<unknown>).catch(error => {
        if (__DEV__) {
          console.warn(`[analytics] ${label} failed`, error);
        }
      });
    }
  } catch (error) {
    if (__DEV__) {
      console.warn(`[analytics] ${label} threw`, error);
    }
  }
};

/**
 * The screen the user is currently on, stamped onto every event as `screen`.
 *
 * `logScreenView` already sends `screen_name`/`screen_class`, but GA4 rewrites
 * those into `firebase_screen`/`firebase_screen_class`, and the `firebase_`
 * prefix is reserved — it cannot be registered as a custom dimension. That makes
 * the built-in screen unreachable anywhere a *registered* dimension is required,
 * including User Explorer's event panel, which lists nothing else.
 *
 * `screen` is not reserved, so it survives verbatim and can be registered. Two
 * things follow from stamping it in `track` rather than only on screen_view:
 *
 *  1. The screen is readable per event in User Explorer.
 *  2. Every other event carries the screen it happened on, which is what makes a
 *     session legible as a sequence rather than a bag of event names.
 *
 * This is additive. The built-in Screen name / Screen class dimensions keep
 * working in reports and explorations exactly as before.
 *
 * Register `screen` in GA4 (Admin > Custom definitions, event-scoped, parameter
 * `screen`) — registration is not retroactive, so values arriving before it
 * exists are collected but never queryable.
 */
let currentScreen: string | null = null;

/** Spreadable so no `screen` key is emitted at all before the first screen view. */
const screenParam = (): { screen?: string } =>
  currentScreen ? { screen: currentScreen } : {};

/**
 * Merge the current screen into an event's params.
 *
 * A declared param of the same name would win, but none exists — no event in
 * `EventParams` declares `screen`.
 */
const withScreen = (
  params?: Record<string, unknown>,
): Record<string, unknown> => ({ ...params, ...screenParam() });

/** Params are only required for events that declare them in `EventParams`. */
type ParamsFor<E extends AnalyticsEventName> = E extends keyof EventParams
  ? [params: EventParams[E]]
  : [params?: Record<string, never>];

/**
 * Log a product event.
 *
 * The name must come from `AnalyticsEvent` and the params must match what that
 * event declares — the compiler rejects anything else, which is what keeps the
 * 500-name budget from being spent on typos.
 */
export const track = <E extends AnalyticsEventName>(
  event: E,
  ...args: ParamsFor<E>
): void => {
  safely(`track(${event})`, () =>
    logEventUnchecked(
      analytics,
      event,
      withScreen(args[0] as Record<string, unknown> | undefined),
    ),
  );
  breadcrumb(`event: ${event}`);
};

/**
 * Log a screen view and pin the screen name onto crash reports.
 *
 * Called from the navigation container, not from screens — see RootNavigator.
 */
export const trackScreen = (screenName: string, screenClass?: string): void => {
  // Set before the event is logged so the screen_view itself carries `screen`,
  // and so any event racing behind it is attributed to the screen now showing.
  currentScreen = screenName;

  safely(`trackScreen(${screenName})`, () =>
    fireLogScreenView(analytics, {
      screen_name: screenName,
      screen_class: screenClass ?? screenName,
      ...screenParam(),
    }),
  );
  // So a crash report names the screen the user was on, not just a stack trace.
  setKey('current_screen', screenName);
  breadcrumb(`screen: ${screenName}`);
};

/**
 * Attach the signed-in user to both SDKs.
 *
 * The Crashlytics half is what makes the console's "Search by user ID" usable —
 * without it every crash report is anonymous.
 */
export const identify = (userId: string): void => {
  safely('identify.analytics', () => fireSetAnalyticsUserId(analytics, userId));
  safely('identify.crashlytics', () =>
    fireSetCrashlyticsUserId(crashlytics, userId),
  );
};

/** Detach the user on sign-out so the next session is not attributed to them. */
export const clearIdentity = (): void => {
  safely('clearIdentity.analytics', () =>
    fireSetAnalyticsUserId(analytics, null),
  );
  safely('clearIdentity.crashlytics', () =>
    fireSetCrashlyticsUserId(crashlytics, ''),
  );
};

/**
 * Set user properties on Analytics and mirror them as Crashlytics attributes,
 * so a crash report carries the same segmentation as the analytics reports.
 *
 * Undefined values are dropped rather than sent — GA4 treats an explicit null as
 * "clear this property", which is not what a caller passing a not-yet-loaded
 * value means.
 */
export const setUserProps = (properties: UserProperties): void => {
  const defined = Object.entries(properties).reduce<Record<string, string>>(
    (accumulator, [key, value]) => {
      if (value !== undefined && value !== null) {
        accumulator[key] = String(value);
      }
      return accumulator;
    },
    {},
  );

  if (Object.keys(defined).length === 0) return;

  safely('setUserProps.analytics', () =>
    fireSetUserProperties(analytics, defined),
  );
  safely('setUserProps.crashlytics', () =>
    fireSetAttributes(crashlytics, defined),
  );
};

/**
 * Record a non-fatal error.
 *
 * This is the workhorse for React Native: failed requests, payment failures and
 * caught exceptions never crash the app, but they are where the real bugs live.
 * `context` becomes a breadcrumb immediately before the report, and `keys` are
 * attached as attributes so the report says *where* as well as *what*.
 */
export const recordError = (
  error: unknown,
  context?: string,
  keys?: Record<string, string | number | boolean>,
): void => {
  if (context) {
    breadcrumb(context);
  }

  if (keys) {
    const stringified = Object.entries(keys).reduce<Record<string, string>>(
      (accumulator, [key, value]) => {
        accumulator[key] = String(value);
        return accumulator;
      },
      {},
    );
    safely('recordError.keys', () =>
      fireSetAttributes(crashlytics, stringified),
    );
  }

  // Crashlytics only accepts a real Error; anything else (a rejected string, an
  // axios object) would otherwise be dropped without a report.
  const normalized =
    error instanceof Error
      ? error
      : new Error(
          typeof error === 'string' ? error : (safeStringify(error) ?? 'Unknown error'),
        );

  safely('recordError', () => fireRecordError(crashlytics, normalized));
};

/** A single line in the trail Crashlytics shows leading up to a crash. */
export const breadcrumb = (message: string): void => {
  safely('breadcrumb', () => fireLogCrash(crashlytics, message));
};

/** Attach one key/value to every subsequent crash report. */
export const setKey = (key: string | UserPropertyName, value: string): void => {
  safely(`setKey(${key})`, () => fireSetAttribute(crashlytics, key, value));
};

/**
 * Force a crash. Test-only.
 *
 * Guarded rather than removed so verifying the Crashlytics pipeline after an SDK
 * or Gradle upgrade stays a one-liner, while release builds cannot reach it.
 */
export const triggerCrash = (): void => {
  if (!__DEV__) return;
  fireCrash(crashlytics);
};

/** JSON.stringify that tolerates circular structures. */
const safeStringify = (value: unknown): string | null => {
  try {
    return JSON.stringify(value);
  } catch {
    return null;
  }
};
