/**
 * OpenTelemetry bootstrap. MUST be the first import in src/index.ts.
 *
 * The SDK works by monkey-patching modules as they are required, so it has to run before
 * anything pulls in `pino`, `http` or `express`. In this codebase that window is very
 * narrow: `src/index.ts` line 4 (`import app from "./app"`) transitively loads the whole
 * route tree — express, mongoose, ioredis, axios, firebase-admin — and
 * `utils/logger/index.ts` calls `createLogger()`, i.e. `pino()`, at import time. Miss the
 * window and everything still runs, silently, with no telemetry at all.
 *
 * Initialisation is an import side effect for that reason. A `initTelemetry()` function
 * called from index.ts would NOT work: TypeScript hoists `import` statements above
 * ordinary statements, so `import app from "./app"` would execute first.
 *
 * What this produces:
 *   - Log records: every pino line, including those from child loggers, is exported over
 *     OTLP/HTTP to the collector. This is additive — the instrumentation wraps the
 *     logger's stream in `pino.multistream([stdout, otel])`, so stdout -> Cloud Logging
 *     keeps working unchanged and remains the fallback if the collector is down.
 *   - Trace context: `trace_id` / `span_id` / `trace_flags` are injected per record from
 *     the active span, so the collector can join logs to traces.
 *   - Spans (opt-in, OTEL_TRACES_ENABLED): via @opentelemetry/auto-instrumentations-node,
 *     which covers express, mongoose, ioredis and http — and therefore also axios,
 *     firebase-admin, twilio and razorpay, all of which are HTTP underneath.
 *   - Metrics (opt-in, OTEL_METRICS_ENABLED): request/DB/cache metrics from the same
 *     instrumentations, plus Node runtime metrics when `runtime-node` is in the
 *     instrumentation allowlist.
 *
 * Resource attributes come from a detector list passed in code — NOT from
 * OTEL_NODE_RESOURCE_DETECTORS, which cannot express `gcp` and silently disables every
 * detector when given a name it does not know. See the note by `resourceDetectors` below.
 *
 * Coverage is tunable from the environment, with no code change or redeploy of this file:
 *   OTEL_NODE_DISABLED_INSTRUMENTATIONS=dns,net     (the default set here)
 *   OTEL_NODE_ENABLED_INSTRUMENTATIONS=http,express,mongoose,ioredis,pino   (allowlist)
 * Names are the package suffix, comma separated. See the note by the env-var default below
 * for why the noisy ones are disabled that way rather than in code.
 */
import dotenv from "dotenv";
dotenv.config();

import { diag, DiagConsoleLogger, DiagLogLevel } from "@opentelemetry/api";
import { NodeSDK } from "@opentelemetry/sdk-node";
import {
    resourceFromAttributes,
    envDetector,
    processDetector,
    hostDetector,
    osDetector,
    serviceInstanceIdDetector,
} from "@opentelemetry/resources";
import { gcpDetector } from "@opentelemetry/resource-detector-gcp";
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from "@opentelemetry/semantic-conventions";
import { BatchLogRecordProcessor } from "@opentelemetry/sdk-logs";
import { PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics";
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-http";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-http";
import { PinoInstrumentation } from "@opentelemetry/instrumentation-pino";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import type { Instrumentation } from "@opentelemetry/instrumentation";
import type { IncomingMessage } from "http";
import { GoogleAuth, type IdTokenClient } from "google-auth-library";

import env from "./config/env";
import { registerShutdownHook } from "./utils/shutdownRegistry";

const DIAG_LEVELS: Record<string, DiagLogLevel> = {
    none: DiagLogLevel.NONE,
    error: DiagLogLevel.ERROR,
    warn: DiagLogLevel.WARN,
    info: DiagLogLevel.INFO,
    debug: DiagLogLevel.DEBUG,
    verbose: DiagLogLevel.VERBOSE,
    all: DiagLogLevel.ALL,
};

/**
 * Health-check paths must not produce spans. Cloud Run probes these constantly and each
 * one would otherwise become a trace, drowning real traffic and inflating collector cost.
 * Kept in step with the same list already excluded from HTTP logging in
 * utils/logger/httpLogger.ts.
 */
const UNTRACED_PATHS = new Set(["/health", "/healthz", "/readiness", "/liveness"]);

/**
 * Builds the Authorization header for a collector deployed --no-allow-unauthenticated.
 *
 * The OTLP exporters accept `headers` as either a static record or a factory that is
 * invoked once per export (`HeadersFactory = () => Promise<Record<string, string>>`).
 * The factory form is what makes this possible at all: Google ID tokens expire after
 * roughly an hour, so a static header would authenticate for the first hour of an
 * instance's life and then 401 forever after — on a long-lived Cloud Run instance, that
 * looks like telemetry mysteriously stopping.
 */
function createHeadersFactory(): (() => Promise<Record<string, string>>) | undefined {
    if (env.OTEL_AUTH_MODE === "none") return undefined;

    const audience = env.OTEL_COLLECTOR_AUDIENCE;
    if (!audience) {
        diag.warn(
            "OTEL_AUTH_MODE is oidc but no collector audience could be resolved; exporting without authentication",
        );
        return undefined;
    }

    const auth = new GoogleAuth();
    // Built once and reused: IdTokenClient caches the token and refreshes it before
    // expiry internally. Constructing a client per export would hit the metadata server
    // on every flush.
    let clientPromise: Promise<IdTokenClient> | undefined;

    return async (): Promise<Record<string, string>> => {
        // The contract on HeadersFactory is explicit that it must not throw. A blip on the
        // metadata server has to degrade to a failed export, never an unhandled rejection
        // that takes the process down.
        try {
            clientPromise ??= auth.getIdTokenClient(audience);
            const headers = await (await clientPromise).getRequestHeaders();
            // google-auth-library v10 returns a web `Headers` object, not a plain object.
            // Spreading it yields {} and every export 403s, with nothing to explain why.
            return Object.fromEntries(headers.entries());
        } catch (error) {
            // Drop the cached client so the next flush retries the whole handshake rather
            // than awaiting a promise that already rejected.
            clientPromise = undefined;
            diag.warn(
                `Failed to mint OIDC token for the OTel collector (audience: ${audience}): ${
                    error instanceof Error ? error.message : String(error)
                }`,
            );
            return {};
        }
    };
}

let shutdown: () => Promise<void> = async () => {};

function start(): void {
    if (!env.OTEL_ENABLED) return;

    // No endpoint is the normal state locally and in CI. Staying silent here is
    // deliberate: a configured-but-absent collector would log an export failure on every
    // single flush, which is worse than no telemetry.
    if (!env.OTEL_EXPORTER_OTLP_ENDPOINT) return;

    const diagLevel = DIAG_LEVELS[env.OTEL_DIAG_LOG_LEVEL];
    if (diagLevel !== undefined) {
        diag.setLogger(new DiagConsoleLogger(), diagLevel);
    }

    const endpoint = env.OTEL_EXPORTER_OTLP_ENDPOINT.replace(/\/+$/, "");
    const headers = createHeadersFactory();

    // `service.instance.id` is deliberately NOT set here. It used to be K_REVISION, which
    // names the Cloud Run *revision* — so every instance of a revision reported the same
    // id, and Grafana rejects the resulting metric series as duplicate samples.
    // `serviceInstanceIdDetector` below supplies a per-process UUID instead.
    const resource = resourceFromAttributes({
        [ATTR_SERVICE_NAME]: env.SERVICE_NAME,
        [ATTR_SERVICE_VERSION]: env.SERVICE_VERSION,
        "deployment.environment.name": env.DEPLOYMENT_ENV,
    });

    /**
     * Resource detectors, passed in code rather than via OTEL_NODE_RESOURCE_DETECTORS.
     *
     * The env var cannot express `gcp` — NodeSDK's map only knows host, os,
     * serviceinstance, process and env — and it does not degrade gracefully: an
     * unrecognised name logs "Invalid resource detector" and yields an EMPTY list, losing
     * every detector including the ones that would have worked. So it must be code, and
     * setting that variable at all is a trap.
     *
     * Note NodeSDK merges as `configuredResource.merge(detected)`, and merge lets the
     * ARGUMENT win — detected attributes override the ones built above. That is what makes
     * dropping `service.instance.id` sufficient rather than merely tidy.
     */
    const resourceDetectors = [
        envDetector,
        processDetector,
        hostDetector,
        osDetector,
        // Per-process randomUUID. Unique per instance, which is the whole requirement.
        serviceInstanceIdDetector,
        // cloud.provider/region/account.id, faas.name/instance/version, host.id — read
        // from the Cloud Run metadata server. Absent (without error) off GCP.
        gcpDetector,
    ];

    // Make OTEL_TRACES_ENABLED=false mean what it says.
    //
    // Skipping the auto-instrumentations is not sufficient on its own: NodeSDK falls back
    // to building a default OTLP span exporter from OTEL_EXPORTER_OTLP_ENDPOINT whenever
    // OTEL_TRACES_EXPORTER is unset, so the spans this codebase creates BY HAND — the cron
    // scheduler and the Redis subscriber both open root spans — would still be exported
    // while tracing was supposedly off. Measured: one span reached the collector with
    // OTEL_TRACES_ENABLED=false.
    //
    // "none" makes the SDK build no span processors. Despite the SDK's own warning text
    // ("SDK will not be initialized"), this affects tracing only; the logRecordProcessors
    // passed explicitly below are untouched, so log export continues normally.
    if (!env.OTEL_TRACES_ENABLED && process.env.OTEL_TRACES_EXPORTER === undefined) {
        process.env.OTEL_TRACES_EXPORTER = "none";
    }

    // Same guard for metrics, and it is needed for a sharper reason. NodeSDK treats an
    // UNSET OTEL_METRICS_EXPORTER as "otlp" and builds a metric reader from the
    // environment on its own, so without this line OTEL_METRICS_ENABLED=false would
    // export metrics anyway — the flag would look like it did nothing.
    //
    // Both guards only fire when the variable is unset, so an explicitly configured
    // OTEL_*_EXPORTER always wins. That means setting OTEL_METRICS_EXPORTER=otlp in the
    // deployment disables this kill switch; don't.
    if (!env.OTEL_METRICS_ENABLED && process.env.OTEL_METRICS_EXPORTER === undefined) {
        process.env.OTEL_METRICS_EXPORTER = "none";
    }

    const pinoConfig = {
        // The point of this integration: pino records become OTel LogRecords.
        disableLogSending: false,
        // Adds trace_id / span_id / trace_flags per record, read from the active span at
        // emit time. This is why trace context must NOT live in child logger bindings,
        // which pino freezes at creation.
        disableLogCorrelation: false,
    };

    // Quieten the noisiest instrumentations by DEFAULT, without hard-coding the decision.
    //
    //   dns, net - a span per DNS lookup and per TCP connect. Against Mongo Atlas, Redis,
    //     Firebase, Twilio and Razorpay that is a large, permanent volume of spans saying
    //     almost nothing the HTTP and DB spans do not already say. Volume is what a
    //     collector bills for.
    //   router - Express 5 delegates its routing to the standalone `router` package, so
    //     this instrumentation and instrumentation-express BOTH wrap the same layer.
    //     Measured against this service: every request produced a DUPLICATE
    //     "request handler - /path" span plus two spans named "middleware - patched",
    //     which carry no name worth reading. Disabling it took a /ok trace from 6 spans
    //     to 4, all of them meaningful.
    //     The one real loss: instrumentation-express does not wrap 4-argument error
    //     middleware, so the "middleware - errorHandler" span goes away with it. That is
    //     an acceptable trade — errorHandler.middleware.ts already calls recordException
    //     and setStatus(ERROR) on the server span, and logs the fault, so the error is
    //     still fully visible; only its middleware-level timing is not.
    //
    // (`fs` and `host-metrics` are already in the bundle's defaultExcludedInstrumentations,
    // so they need no handling here.)
    //
    // Set through the env var rather than `{ enabled: false }` deliberately: the bundle
    // treats programmatic config as priority 1, so a code-level disable CANNOT be undone
    // from the environment. Seeding the env var instead keeps the whole thing tunable
    // without a deploy — which is the main reason to use this bundle at all. To re-enable
    // them, set OTEL_NODE_DISABLED_INSTRUMENTATIONS to "" or to any other list.
    if (process.env.OTEL_NODE_DISABLED_INSTRUMENTATIONS === undefined) {
        process.env.OTEL_NODE_DISABLED_INSTRUMENTATIONS = "dns,net,router";
    }

    // With traces off there is nothing for the span-producing instrumentations to do, and
    // loading all ~39 of them costs roughly 100ms of cold start — which lands on a real
    // user's request, since Cloud Run scales this service to zero. Log export does not
    // depend on any of them, so the logs-only path takes just the pino instrumentation.
    const instrumentations: Instrumentation[] = env.OTEL_TRACES_ENABLED
        ? getNodeAutoInstrumentations({
              "@opentelemetry/instrumentation-pino": pinoConfig,
              "@opentelemetry/instrumentation-http": {
                  ignoreIncomingRequestHook: (request: IncomingMessage) => {
                      const path = (request.url || "").split("?")[0];
                      return path !== undefined && UNTRACED_PATHS.has(path);
                  },
              },
          })
        : [new PinoInstrumentation(pinoConfig)];

    const sdk = new NodeSDK({
        resource,
        resourceDetectors,
        instrumentations,
        // Batched, never simple: one HTTP round trip per log line would add latency to
        // every request and swamp the collector.
        logRecordProcessors: [
            new BatchLogRecordProcessor({
                exporter: new OTLPLogExporter({
                    url: `${endpoint}/v1/logs`,
                    ...(headers ? { headers } : {}),
                }),
            }),
        ],
        ...(env.OTEL_TRACES_ENABLED
            ? {
                  traceExporter: new OTLPTraceExporter({
                      url: `${endpoint}/v1/traces`,
                      ...(headers ? { headers } : {}),
                  }),
              }
            : {}),
        // Built explicitly rather than left to the SDK's env path, so metrics go through
        // the same createHeadersFactory() as logs and traces. The env-built exporter
        // carries no Authorization header — harmless for a loopback sidecar, silently
        // broken the day the collector moves anywhere else.
        //
        // Passing metricReaders bypasses the env path entirely, which also means
        // OTEL_METRIC_EXPORT_INTERVAL has to be read here or it would be ignored.
        ...(env.OTEL_METRICS_ENABLED
            ? {
                  metricReaders: [
                      new PeriodicExportingMetricReader({
                          exporter: new OTLPMetricExporter({
                              url: `${endpoint}/v1/metrics`,
                              ...(headers ? { headers } : {}),
                          }),
                          exportIntervalMillis:
                              Number(process.env.OTEL_METRIC_EXPORT_INTERVAL) || 60_000,
                      }),
                  ],
              }
            : {}),
    });

    sdk.start();

    shutdown = async () => {
        await sdk.shutdown();
    };

    // Without this the batched records buffered at the moment of SIGTERM are lost on every
    // Cloud Run scale-down. See utils/logger/pino.config.ts, which drains the registry.
    registerShutdownHook({ name: "opentelemetry", run: () => shutdown() });
}

start();

/**
 * Flushes and shuts down the SDK. Safe to call when telemetry never started.
 *
 * Prefer letting the shutdown registry call this; it is exported for tests and for any
 * entry point that manages its own lifecycle.
 */
export async function shutdownTelemetry(): Promise<void> {
    await shutdown();
}
