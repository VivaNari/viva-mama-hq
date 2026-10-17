import axios, { AxiosInstance, AxiosError } from "axios";
import axiosRetry, { IAxiosRetryConfig } from "axios-retry";
import AsyncStorage from "@react-native-async-storage/async-storage";
import i18n from "../i18n";
import { BASE_API_URL } from "../constants/endpoints";
import { triggerUnauthorized } from "./authEventHandler";
import { triggerPaywall } from "./paywallEventHandler";
import { DenialPayload } from "../types/entitlements.types";
import { recordError } from "../analytics";

/**
 * Codes the server sends when it does not know who the caller is — a missing, expired
 * or forged token. Mirrors `EAuthDenial` in the backend's `types/auth.types.ts`.
 *
 * Everything else is an *authorization* refusal: the session is fine, the answer is no.
 */
const AUTH_DENIAL_CODES = ["TOKEN_MISSING", "TOKEN_INVALID"] as const;

/**
 * Does this response mean the session is dead, as opposed to the action being refused?
 *
 * 401 always does — there is no authenticated request behind it to preserve.
 *
 * 403 is the one that needs deciding. By the letter of HTTP it covers both "I do not
 * know you" and "I know you, and no", and this app used to treat every one of them as
 * the first. That was accurate while only the auth middleware could produce a 403, and
 * became a bug the moment endpoints started refusing *authenticated* users: a new
 * member who had not yet accepted the community guidelines was signed out of the whole
 * product for trying to leave a comment.
 *
 * **The default is deliberate.** A 403 carrying no code at all is treated as an expired
 * session. The app and the API deploy separately, so this has to stay correct against a
 * server that predates the codes — and of the two ways to be wrong, an unnecessary
 * logout is far kinder than stranding someone in a session where every request fails
 * and nothing ever offers them the login screen.
 */
const isSessionDead = (status: number, code: unknown): boolean => {
  if (status === 401) return true;
  if (status !== 403) return false;
  if (typeof code !== "string") return true;
  return (AUTH_DENIAL_CODES as readonly string[]).includes(code);
};

/**
 * In-memory token cache
 * (prevents AsyncStorage hit per request)
 */
let authToken: string | null = null;
let tokenInitialized = false;

/**
 * Guard so a burst of 401s (multiple in-flight requests on token expiry)
 * only triggers a single logout/toast. Reset when a new token is set.
 */
let isLoggingOut = false;

const initTokenIfNeeded = async () => {
  if (!tokenInitialized) {
    authToken = await AsyncStorage.getItem("userToken");
    tokenInitialized = true;
  }
};

/**
 * Report a failed request to Crashlytics as a non-fatal.
 *
 * This interceptor is the single choke point for every backend call in the app,
 * which makes it the highest-yield place to catch real breakage: the app keeps
 * running, the user sees a toast, and without this nobody ever hears about it.
 *
 * Only genuine faults are recorded — 401/403 (routine token expiry, handled by
 * the auth handler) and 402 (a paywall refusal, not a fault) are filtered out by
 * the caller before reaching here. What is left is 4xx client bugs, 5xx server
 * faults, and timeouts/network drops.
 *
 * One report per request, not per attempt: `axiosRetry` installs its response
 * interceptor before ours, so it exhausts its retries first and we only ever see
 * the final failure. Keep that registration order if this block is reshuffled.
 *
 * Only the URL path, method and status are attached. Query params and request
 * bodies are deliberately excluded: they carry tokens, phone numbers and health
 * answers, none of which may leave the device.
 */
const reportRequestFailure = (error: AxiosError, status?: number) => {
  const method = error.config?.method?.toUpperCase() ?? "UNKNOWN";
  // `url` is the path as passed to axios, before baseURL and params are merged.
  const path = error.config?.url ?? "unknown";
  const isNetworkError = status === undefined;

  recordError(error, `API ${method} ${path} failed`, {
    api_method: method,
    api_path: path,
    api_status: status ?? "network_error",
    api_kind: isNetworkError ? "network" : status >= 500 ? "server" : "client",
  });
};

/**
 * SINGLETON INSTANCE
 */
let apiInstance: AxiosInstance | null = null;

const apiClientInterceptor = (): AxiosInstance => {
  // 👉 Return existing instance if already created
  if (apiInstance) {
    return apiInstance;
  }

  apiInstance = axios.create({
    baseURL: BASE_API_URL,
    timeout: 15000,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
  });

  /**
   * RETRY CONFIG
   */
  const retryOptions: IAxiosRetryConfig = {
    retries: 5,
    retryCondition: (err: AxiosError) => {
      const status = err.response?.status;
      // Don't retry an expired/invalid token — let the auth handler log out.
      if (status === 401 || status === 403) return false;
      // Retry only on network errors & 5xx (4xx client errors aren't transient).
      return status === undefined || status >= 500;
    },

    retryDelay: (retryCount, err) => {
      const retryAfter = 1000;
      if (retryAfter) {
        return Number(retryAfter) * 1000; // seconds → ms
      }
      return axiosRetry.exponentialDelay(retryCount);
    },
  };

  axiosRetry(apiInstance as any, retryOptions);

  /**
   * REQUEST INTERCEPTOR
   */
  apiInstance.interceptors.request.use(
    async config => {
      authToken = await AsyncStorage.getItem("userToken");
      tokenInitialized = true;

      const isBackendRequest = config.baseURL?.includes(BASE_API_URL);

      if (authToken && isBackendRequest) {
        config.headers.Authorization = `Bearer ${authToken}`;
        // A valid token is present again (e.g. after re-login) — re-arm the
        // one-shot logout guard for the next expiry.
        isLoggingOut = false;
      }

      // Tag every backend request with the active UI language so localized
      // endpoints return matching content immediately, even before the user's
      // persisted preference round-trips. Backend ignores `lang` where it
      // doesn't apply. (SSE/chat streams don't go through axios and rely on the
      // persisted preferred_language instead.)
      if (isBackendRequest) {
        config.params = { ...config.params, lang: i18n.language };
      }

      if (__DEV__) {
        console.log(
          `[API] ${config.method?.toUpperCase()} ${config.baseURL}${
            config.url
          }`,
        );
      }

      return config;
    },
    error => Promise.reject(error),
  );

  /**
   * RESPONSE INTERCEPTOR
   */
  apiInstance.interceptors.response.use(
    response => response,
    async (error: AxiosError) => {
      const status = error.response?.status;

      // 402 is a paywall refusal, not a fault: the request was well-formed and the
      // user is authenticated, they simply are not entitled. The server sends the
      // capability, tier, limit and reset time, so the paywall can be opened with real
      // context instead of a generic error toast.
      //
      // Still rejected afterwards, so the calling screen can also react (disable an
      // input, show an inline upsell) rather than silently appearing to succeed.
      if (status === 402) {
        const denial = (error.response?.data as { data?: DenialPayload })?.data;
        if (denial?.code) {
          triggerPaywall(denial);
        }
        return Promise.reject(error);
      }

      const denialCode = (error.response?.data as { data?: { code?: string } })?.data
        ?.code;

      // Session genuinely gone — clear it and send the user to the login screen.
      if (status !== undefined && isSessionDead(status, denialCode)) {
        authToken = null;
        tokenInitialized = true;
        await AsyncStorage.removeItem("userToken");

        // Only trigger logout once per expiry burst.
        if (!isLoggingOut) {
          isLoggingOut = true;
          triggerUnauthorized();
        }
        return Promise.reject(error);
      }

      // An authorization refusal: the caller is known and signed in, and simply may not
      // do this. Not a fault either — the user hitting a rule the product intends to
      // enforce is the system working. Reporting it would bury real breakage under
      // routine events like "has not accepted the community guidelines yet".
      if (status === 403) {
        return Promise.reject(error);
      }

      reportRequestFailure(error, status);
      return Promise.reject(error);
    },
  );

  return apiInstance;
};

export default apiClientInterceptor;
