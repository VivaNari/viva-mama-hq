// src/logger/pino.config.ts
import pino, { LoggerOptions } from "pino";
import { redactOptions } from "./redaction";
import { serializers } from "./serializers";
import { getTransports } from "./transports";
import dotenv from "dotenv";
dotenv.config();

import env from "../../config/env";

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
            bindings: (bindings: pino.Bindings) => {
                return {
                    pid: bindings.pid,
                    hostname: bindings.hostname,
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

    process.on("uncaughtException", (error) => {
        logger.fatal({ err: error }, "Uncaught Exception");
        process.exit(1);
    });

    process.on("unhandledRejection", (reason, promise) => {
        logger.fatal(
            {
                err: reason as Error,
                promise: promise,
            },
            "Unhandled Promise Rejection",
        );
        process.exit(1);
    });

    process.on("warning", (warning) => {
        logger.warn({ warning: warning.message, stack: warning.stack }, "Process Warning");
    });

    process.on("exit", (code) => {
        logger.info({ exitCode: code }, "Process exiting");
    });

    const shutdown = (signal: string) => {
        logger.info({ signal }, "Received shutdown signal");
        logger.flush();
        process.exit(0);
    };

    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT", () => shutdown("SIGINT"));

    return logger;
}
