import { EBillingMode } from "../types/subscription.types";

/**
 * Parse BILLING_MODE at boot rather than casting it at the point of use.
 *
 * A typo'd value would otherwise surface as a failed checkout for a real user; here it
 * is caught the moment the process starts. Unset is a legitimate default (MANUAL);
 * set-but-invalid is a deployment mistake and throws.
 */
function parseBillingMode(raw: string | undefined): EBillingMode {
    if (!raw) return EBillingMode.MANUAL;

    const normalized = raw.trim().toUpperCase();
    if (
        normalized === EBillingMode.MANUAL ||
        normalized === EBillingMode.AUTOPAY ||
        normalized === EBillingMode.PLAY
    ) {
        return normalized as EBillingMode;
    }

    throw new Error(
        `Invalid BILLING_MODE "${raw}". Expected ${EBillingMode.MANUAL}, ${EBillingMode.AUTOPAY} or ${EBillingMode.PLAY}.`,
    );
}

/**
 * How the OTLP exporters authenticate to the collector.
 *
 *   oidc - mint a Google ID token for OTEL_COLLECTOR_AUDIENCE and send it as a bearer
 *          token. Correct for a collector deployed as its own private Cloud Run service.
 *   none - send no Authorization header. Correct for a collector running as a SIDECAR in
 *          the same Cloud Run service (traffic goes over localhost and never leaves the
 *          instance) and for the local docker-compose collector.
 *
 * Parsed rather than cast for the same reason as BILLING_MODE, with a sharper edge: a
 * typo here does not fail, it silently exports unauthenticated. Better to refuse to boot.
 */
export type TOtelAuthMode = "oidc" | "none";

/**
 * Loopback means the collector is in this same instance — a Cloud Run sidecar, or
 * docker-compose locally. There is no identity to authenticate to and no network hop to
 * protect, so default to "none" there.
 *
 * Without this, forgetting to set OTEL_AUTH_MODE=none alongside a sidecar endpoint makes
 * every export first ask the metadata server for an ID token whose audience is
 * "http://localhost:4318". That is a pointless round trip on the export path, and it fails
 * in a way that is easy to misread as a telemetry outage.
 */
function isLoopbackEndpoint(endpoint: string): boolean {
    if (!endpoint) return false;
    try {
        const { hostname } = new URL(endpoint);
        return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
    } catch {
        return false;
    }
}

function parseOtelAuthMode(raw: string | undefined, endpoint: string): TOtelAuthMode {
    if (!raw) return isLoopbackEndpoint(endpoint) ? "none" : "oidc";

    const normalized = raw.trim().toLowerCase();
    if (normalized === "oidc" || normalized === "none") {
        return normalized;
    }

    throw new Error(`Invalid OTEL_AUTH_MODE "${raw}". Expected "oidc" or "none".`);
}

/**
 * The OIDC audience Cloud Run expects is the receiving service's base URL, which is
 * exactly the origin of the OTLP endpoint. Deriving it saves operators from setting two
 * env vars that must agree — a mismatch is a 401 with nothing in the logs to explain it.
 * An explicit OTEL_COLLECTOR_AUDIENCE still wins, for the case where the collector sits
 * behind a load balancer whose audience differs from its URL.
 */
function resolveCollectorAudience(explicit: string | undefined, endpoint: string): string {
    const trimmed = explicit?.trim();
    if (trimmed) return trimmed;
    if (!endpoint) return "";

    try {
        return new URL(endpoint).origin;
    } catch {
        throw new Error(
            `Invalid OTEL_EXPORTER_OTLP_ENDPOINT "${endpoint}". Expected an absolute URL, e.g. https://otel-collector-abc123-el.a.run.app`,
        );
    }
}

const NODE_ENV = process.env.NODE_ENV || "development";

// Trimmed because it is interpolated into the exporter URL (`${endpoint}/v1/logs`) and
// used as the OIDC audience — the same trailing-newline trap documented on
// PLAY_PACKAGE_NAME below, where a value piped in from a shell breaks every request.
const OTEL_EXPORTER_OTLP_ENDPOINT = (process.env.OTEL_EXPORTER_OTLP_ENDPOINT || "").trim();

const env = {
    NODE_ENV,
    SERVICE_NAME: process.env.SERVICE_NAME || "my-service",
    SERVICE_VERSION: process.env.SERVICE_VERSION || "1.0.0",
    ENABLE_PII_REDACTION: process.env.ENABLE_PII_REDACTION === "true",
    MONGO_URI: process.env.MONGO_URI as string,
    MONGODB_HOST: process.env.MONGODB_HOST,
    MONGODB_PORT: process.env.MONGODB_PORT,
    MONGODB_USERNAME: process.env.MONGODB_USERNAME,
    MONGODB_PASSWORD: process.env.MONGODB_PASSWORD,
    MONGODB_DATABASE: process.env.MONGODB_DATABASE,
    PORT: Number(process.env.PORT),
    TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID,
    TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN,
    TWILIO_PHONE_NUMBER: process.env.TWILIO_PHONE_NUMBER,
    TWILIO_WHATSAPP_PHONE_NUMBER: process.env.TWILIO_WHATSAPP_PHONE_NUMBER,
    JWT_SECRET: process.env.JWT_SECRET,
    CRYPTO_PASSWORD: process.env.CRYPTO_PASSWORD,
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    LOG_LEVEL: process.env.LOG_LEVEL || "info",
    LOG_PRETTY_PRINT: process.env.LOG_PRETTY_PRINT === "true",
    LOG_FILE_PATH: process.env.LOG_FILE_PATH || "./logs",
    LOG_TO_FILE: process.env.LOG_TO_FILE === "true",
    RAZORPAY_API_KEY: process.env.RAZORPAY_API_KEY,
    RAZORPAY_SECRET_KEY: process.env.RAZORPAY_SECRET_KEY,
    // Which billing rail NEW subscriptions are created on.
    //   MANUAL  - one-time Razorpay Orders. Trial starts without payment details; on day 7 the
    //             user drops to FREE and must purchase manually. No Play Billing work needed.
    //   AUTOPAY - Razorpay Subscriptions/mandate. Card saved at trial start, auto-debited on day 7.
    // NOTE: existing subscriptions keep the mode stamped on their own row (`subscriptions.billingMode`)
    // — flipping this never retroactively changes a subscription a user already agreed to. Only the
    // app learns the current mode, via GET /subscription/me, so switching needs no client release.
    BILLING_MODE: parseBillingMode(process.env.BILLING_MODE),
    RAZORPAY_WEBHOOK_SECRET: process.env.RAZORPAY_WEBHOOK_SECRET,
    // Google Play Billing. Full service-account key JSON for the Play Developer API,
    // injected from Secret Manager exactly like GOOGLE_MEET_SA_KEY_JSON below — never
    // written to .env, because this identity can read revenue and issue refunds.
    //
    // The account also needs, in Play Console -> Users and permissions, app-scoped
    // "View financial data" + "Manage orders and subscriptions". Without that grant the
    // key authenticates cleanly and every call returns 403.
    PLAY_DEVELOPER_SA_KEY_JSON: process.env.PLAY_DEVELOPER_SA_KEY_JSON,
    // The Android application id, which is part of every Play Developer API path.
    //
    // Trimmed because it is interpolated straight into a URL: a value created from a
    // shell (`echo ... | gcloud secrets create`) carries a trailing newline, which turns
    // every request into .../applications/com.example%0A/purchases/... and comes back as
    // an opaque 400. parseBillingMode already trims for the same reason.
    PLAY_PACKAGE_NAME: (process.env.PLAY_PACKAGE_NAME || "com.wellnessemporio.vivamama").trim(),
    // Identity Pub/Sub uses to sign the OIDC token on Play RTDN pushes. Unlike the
    // Razorpay webhook there is no body signature to fall back on, so this is the only
    // thing standing between the entitlement-changing RTDN endpoint and the open
    // internet. Set it to the service account configured on the push subscription.
    // Trimmed for the same reason: the middleware compares it for exact equality against
    // the token's verified `email` claim, so one stray byte rejects every delivery.
    PUBSUB_PUSH_SA_EMAIL: process.env.PUBSUB_PUSH_SA_EMAIL?.trim(),
    LLM_SERVER_URL: process.env.LLM_SERVER_URL as string,
    LLM_API_KEY: process.env.LLM_API_KEY as string,
    GETGABS_API_KEY: process.env.GETGABS_API_KEY as string,
    GETGABS_CAMPAIGN_ID: process.env.GETGABS_CAMPAIGN_ID as string,
    GETGABS_SENDER: process.env.GETGABS_SENDER as string,
    // Google Meet link generation for consultations. Off by default: with this unset the
    // booking flow still works end to end and ops paste links in by hand, which is also
    // the kill switch if the Meet API misbehaves in production.
    GOOGLE_MEET_ENABLED: process.env.GOOGLE_MEET_ENABLED === "true",
    // The Workspace user the service account impersonates. Every generated space is owned
    // by this account, so it must be a real licensed user on the vivamama.in domain.
    GOOGLE_MEET_IMPERSONATED_USER: process.env.GOOGLE_MEET_IMPERSONATED_USER,
    // Full service-account key JSON, injected from Secret Manager as an env var rather
    // than mounted as a file — keeps credentials out of the image and the repo.
    GOOGLE_MEET_SA_KEY_JSON: process.env.GOOGLE_MEET_SA_KEY_JSON,
    // Firebase Admin (push notifications). Full service-account key JSON, injected from
    // Secret Manager as an env var exactly like the two keys above.
    //
    // Optional. When unset, src/config/firebase.ts falls back to Application Default
    // Credentials — correct on Cloud Run *provided* the attached runtime service account
    // holds an FCM-sending role (roles/firebasemessaging.admin). Set this when the runtime
    // account does not, which is the case today: cloud-run-app-sa has only
    // secretmanager.secretAccessor, run.*, aiplatform.user and iam.serviceAccountUser.
    FIREBASE_SA_KEY_JSON: process.env.FIREBASE_SA_KEY_JSON,
    // Base URL of the ONIX BPP adapter's caller endpoint. Local docker: http://localhost:8082
    // (the onix-bpp container's published port). In prod set to the adapter's Cloud Run URL.
    BECKN_BPP_CALLER_URL: process.env.BECKN_BPP_CALLER_URL || "http://localhost:8082",
    // Cloud Scheduler -> cron job endpoints (see src/middlewares/cloudScheduler.middleware.ts).
    // Email of the service account Cloud Scheduler uses to mint the OIDC token. The middleware
    // only accepts tokens whose verified `email` claim matches this value.
    SCHEDULER_SA_EMAIL: process.env.SCHEDULER_SA_EMAIL,
    // Expected OIDC audience — this service's own Cloud Run base URL.
    CLOUD_RUN_URL: process.env.CLOUD_RUN_URL,
    // Shared-secret bypass for the cron endpoints, honoured ONLY in development so the jobs can
    // be curled locally without minting a real OIDC token. Never set this in prod/uat.
    CRON_DEV_SECRET: process.env.CRON_DEV_SECRET,
    // When true, run the legacy in-process node-cron scheduler (local dev only). In prod/uat the
    // jobs are driven by Cloud Scheduler hitting the HTTP endpoints, so this stays unset/false.
    ENABLE_IN_PROCESS_CRON: process.env.ENABLE_IN_PROCESS_CRON === "true",
    // ── OpenTelemetry ────────────────────────────────────────────────────────────────
    // Log records (and optionally spans) are exported over OTLP/HTTP to a collector that
    // runs as its own Cloud Run service. stdout logging is unaffected: the pino
    // instrumentation adds the OTel stream alongside the existing one, so Cloud Logging
    // stays the fallback if the collector is unreachable.
    //
    // Master switch. Never on under test: jest would otherwise open an exporter handle per
    // suite and hang on `detectOpenHandles`.
    OTEL_ENABLED: process.env.OTEL_ENABLED !== "false" && NODE_ENV !== "test",
    // Collector base URL, WITHOUT the signal path — the exporters append /v1/logs and
    // /v1/traces themselves. Empty disables telemetry entirely, which is the correct
    // default for local dev and CI: there is no collector there, and a configured-but-
    // absent endpoint means an export error logged on every flush.
    OTEL_EXPORTER_OTLP_ENDPOINT,
    OTEL_COLLECTOR_AUDIENCE: resolveCollectorAudience(
        process.env.OTEL_COLLECTOR_AUDIENCE,
        OTEL_EXPORTER_OTLP_ENDPOINT,
    ),
    OTEL_AUTH_MODE: parseOtelAuthMode(
        process.env.OTEL_AUTH_MODE,
        OTEL_EXPORTER_OTLP_ENDPOINT,
    ),
    // Spans are opt-in. Without them every log record still exports, just with an empty
    // trace_id — so this can stay false until the collector has a traces pipeline.
    OTEL_TRACES_ENABLED: process.env.OTEL_TRACES_ENABLED === "true",
    // Metrics are opt-in too, and OFF is the safe default for a reason worth knowing: the
    // OTel SDK treats an unset OTEL_METRICS_EXPORTER as "otlp", so without this flag (and
    // the guard it drives in telemetry.ts) metrics would start exporting the moment an
    // endpoint is configured, whether or not anyone asked for them.
    OTEL_METRICS_ENABLED: process.env.OTEL_METRICS_ENABLED === "true",
    // Set to "debug" to surface exporter failures (401/403 from the collector, DNS, etc.)
    // through OTel's own diagnostic logger. Off by default because it is very chatty.
    OTEL_DIAG_LOG_LEVEL: (process.env.OTEL_DIAG_LOG_LEVEL || "").trim().toLowerCase(),
    // Becomes the `deployment.environment.name` resource attribute, which is how the
    // collector separates uat from prod. Defaults to NODE_ENV, which is "production" on
    // both — set it explicitly per environment to tell them apart.
    DEPLOYMENT_ENV: (process.env.DEPLOYMENT_ENV || NODE_ENV).trim(),
    isDevelopment(): boolean {
        return env.NODE_ENV === "development";
    },

    isProduction(): boolean {
        return env.NODE_ENV === "production";
    },

    isTest(): boolean {
        return env.NODE_ENV === "test";
    },
};

export default env;
