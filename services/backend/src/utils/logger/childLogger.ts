// src/logger/childLogger.ts
import { Logger } from "pino";
import { AppLoggerOptions } from "../../types/logger.types";

/**
 * Child loggers carry STATIC structural context — which component, module or worker a line
 * came from. They are the unit of identity in the logs, and their bindings become
 * attributes on the OpenTelemetry log records exported to the collector: the pino
 * instrumentation swaps the root logger's stream for a multistream, and children inherit
 * it through the prototype chain, so nothing extra is needed here to reach OTel.
 *
 * Deliberately NOT here:
 *
 *   - Request context (correlationId, requestId, userId). pino pre-serialises child
 *     bindings into a string when the child is created, so a logger built at module scope
 *     — which is the whole point of createModuleLogger — would freeze an empty context at
 *     import time and repeat it for the life of the process. That context comes from the
 *     `mixin` in pino.config.ts, which is evaluated per record.
 *
 *   - Trace context (trace_id, span_id). Same reason, more sharply: a request-scoped child
 *     would stamp one span's id onto every record inside that request.
 *     @opentelemetry/instrumentation-pino injects these per record from the active span.
 *
 * Chain these off the ROOT logger, never off each other. pino appends child bindings to a
 * pre-built string without deduplicating keys, so `createRequestLogger(createModuleLogger(
 * logger, "x"), id)` emits `"component"` twice in one JSON object and the first value is
 * lost to any parser that takes last-wins.
 */
export function createChildLogger(parentLogger: Logger, options: AppLoggerOptions): Logger {
    const bindings: Record<string, unknown> = {
        ...(options.name && { component: options.name }),
        ...options.context,
    };

    return parentLogger.child(bindings);
}

export function createModuleLogger(parentLogger: Logger, moduleName: string): Logger {
    return createChildLogger(parentLogger, {
        name: moduleName,
        context: { module: moduleName },
    });
}

export function createRequestLogger(
    parentLogger: Logger,
    requestId: string,
    additionalContext?: Record<string, any>,
): Logger {
    return createChildLogger(parentLogger, {
        name: "request",
        context: {
            requestId,
            ...additionalContext,
        },
    });
}

export function createUserLogger(parentLogger: Logger, userId: string, sessionId?: string): Logger {
    return createChildLogger(parentLogger, {
        name: "user",
        context: {
            userId,
            ...(sessionId && { sessionId }),
        },
    });
}

export function createWorkerLogger(
    parentLogger: Logger,
    workerName: string,
    jobId?: string,
): Logger {
    return createChildLogger(parentLogger, {
        name: workerName,
        context: {
            worker: workerName,
            ...(jobId && { jobId }),
        },
    });
}
