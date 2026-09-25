// src/logger/pino.config.ts
import pino, { LoggerOptions } from "pino";
import { redactOptions } from "./redaction";
import { serializers } from "./serializers";
import { getTransports } from "./transports";
import dotenv from "dotenv";
dotenv.config();

import env from "../../config/env";
import { getAsyncContext } from "../asyncLocalStorage";
import { runShutdownHooks } from "../shutdownRegistry";

/**
 * Pino level -> Cloud Logging LogSeverity.
 *
 * Only the levels pino actually emits are listed; anything else falls back to DEFAULT
 * rather than being dropped. https://cloud.google.com/logging/docs/reference/v2/rest/v2/LogEntry#LogSeverity
 */
const PINO_LEVEL_TO_CLOUD_SEVERITY: Record<string, string> = {
    trace: "DEBUG",
    debug: "DEBUG",
    info: "INFO",
    warn: "WARNING",
    error: "ERROR",
    fatal: "CRITICAL",
};

export function createPinoConfig(): LoggerOptions {
    const config: LoggerOptions = {
        name: env.SERVICE_NAME,
        level: env.LOG_LEVEL,
        serializers,
        ...(env.ENABLE_PII_REDACTION && { redact: redactOptions }),
        base: {
            env: env.NODE_ENV,
            service: env.SERVICE_NAME,
            version: env.SERVICE_VERSION,
            pid: process.pid,
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            hostname: process.env.HOSTNAME || require("os").hostname(),
        },
        timestamp: () => `,"time":"${new Date().toISOString()}"`,
        formatters: {
            level: (label: string) => {
                return { level: label };
            },
            // Spread the incoming bindings rather than rebuilding the object. Picking out
            // pid and hostname by hand silently discarded everything else in `base` —
            // `service`, `env` and `version` never appeared on a single log line, which
            // are exactly the fields you filter on in a shared Cloud Logging project.
            //
            // Note this formatter applies to the ROOT logger only: pino replaces it with
            // an identity function for children (lib/proto.js, resetChildingsFormatter),
            // so child bindings pass through untouched.
            bindings: (bindings: pino.Bindings) => {
                return {
                    ...bindings,
                    node_version: process.version,
                };
            },
            log: (object: Record<string, any>) => {
                if (object.req) {
                    object.request = object.req;
                    delete object.req;
                }
                if (object.res) {
                    object.response = object.res;
                    delete object.res;
                }
                return object;
            },
        },

        // Per-record request context (correlationId, requestId, userId, ...), read LIVE
        // from AsyncLocalStorage every time a line is written.
        //
        // This has to be a mixin rather than child-logger bindings. pino pre-serialises
        // child bindings into a string at creation time, so a module-level
        // `createModuleLogger(...)` — which runs at import, outside any request — would
        // capture an empty context and repeat it forever. A mixin is evaluated per record,
        // so a logger built once at import still picks up whichever request is in flight.
        //
        // @opentelemetry/instrumentation-pino composes with this rather than replacing it
        // (Object.assign(otelMixin(...), origMixin(...))), so trace_id/span_id and these
        // fields coexist.
        mixin: () => ({ ...getAsyncContext() }),

        messageKey: "msg",
        errorKey: "error",
    };

    if (env.isDevelopment()) {
        config.level = "debug";
    }

    if (env.isProduction()) {
        if (config.level === "debug" || config.level === "trace") {
            config.level = "info";
        }

        // Cloud Logging reads the message from `message` and the level from `severity`.
        // Pino's defaults are `msg` and a numeric `level`, so on Cloud Run every
        // structured log rendered as a BLANK LINE in the log viewer and no severity
        // filter ever matched. The entries were in Cloud Logging the whole time, just
        // invisible in the default view — which is why a failing Play purchase looked
        // like it produced no logs at all.
        //
        // messageKey is set here rather than in the base config so local development
        // keeps pino's own conventions (and pino-pretty keeps working).
        config.messageKey = "message";
        config.formatters!.level = (label: string) => ({
            level: label,
            severity: PINO_LEVEL_TO_CLOUD_SEVERITY[label] ?? "DEFAULT",
        });
    }

    if (env.isTest()) {
        config.level = "silent";
    }

    return config;
}

export function createLogger() {
    const config = createPinoConfig();
    //const transports = getTransports();

    const logger = pino(config);

    // Every exit path below drains the shutdown registry before calling process.exit.
    //
    // This is not tidiness. Log records are exported to the OTel collector in batches, so
    // whatever is sitting in the buffer at the moment of exit is lost unless it is flushed
    // first — and the old handlers called process.exit synchronously, in the same tick.
    // On Cloud Run that meant losing the buffer on every scale-down, and losing precisely
    // the fatal record that explains a crash. runShutdownHooks is bounded and never
    // rejects; see utils/shutdownRegistry.ts.
    const exitAfterFlush = (code: number) => {
        void runShutdownHooks().then(() => {
            logger.flush();
            process.exit(code);
        });
    };

    process.on("uncaughtException", (error) => {
        logger.fatal({ err: error }, "Uncaught Exception");
        exitAfterFlush(1);
    });

    process.on("unhandledRejection", (reason, promise) => {
        logger.fatal(
            {
                err: reason as Error,
                promise: promise,
            },
            "Unhandled Promise Rejection",
        );
        exitAfterFlush(1);
    });

    process.on("warning", (warning) => {
        logger.warn({ warning: warning.message, stack: warning.stack }, "Process Warning");
    });

    process.on("exit", (code) => {
        logger.info({ exitCode: code }, "Process exiting");
    });

    const shutdown = (signal: string) => {
        logger.info({ signal }, "Received shutdown signal");
        exitAfterFlush(0);
    };

    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT", () => shutdown("SIGINT"));

    return logger;
}
