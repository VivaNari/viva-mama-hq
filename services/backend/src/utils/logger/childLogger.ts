// src/logger/childLogger.ts
import { Logger } from "pino";
import { AppLoggerOptions, LogContext } from "../../types/logger.types";
import { getAsyncContext } from "../asyncLocalStorage";

export function createChildLogger(parentLogger: Logger, options: AppLoggerOptions): Logger {
    const context: LogContext = {
        ...options.context,
        ...getAsyncContext(),
    };

    const bindings: any = {
        ...(options.name && { component: options.name }),
        ...context,
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
