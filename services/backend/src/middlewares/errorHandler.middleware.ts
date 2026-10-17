import { NextFunction, Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { SpanStatusCode, trace } from "@opentelemetry/api";
import sendErrorResponse from "../utils/commonFunctions/sendErrorResponse";
import logger, { createModuleLogger } from "../utils/logger";

const log = createModuleLogger(logger, "error-handler");

export const errorHandler = (
    error: Error,
    request: Request,
    response: Response,
    next: NextFunction,
) => {
    // The error is logged here because this is the only place it can be. Nothing further
    // down records it — sendErrorResponse writes it into the HTTP body and returns — so
    // without this line every unmapped fault reaches production logs as the bare string
    // "Error Middleware called", with the message readable only by whoever received the
    // 500. That is how a failing Play purchase verification became undiagnosable.
    //
    // `code` and `status` are lifted out explicitly: the typed errors in this codebase
    // (PlayApiError, SubscriptionError) carry the useful discriminator there rather than
    // in the message, and a log line you have to parse prose out of is a log line nobody
    // greps. Goes through pino, so PII redaction applies.
    log.error(
        {
            err: error,
            code: (error as { code?: unknown }).code,
            status: (error as { status?: unknown }).status,
            method: request.method,
            path: request.originalUrl,
        },
        "Unhandled error",
    );

    // Mark the span as failed for the same reason the line above exists: this is the only
    // place an unmapped fault is seen. Without it the trace shows a 500 with no exception
    // attached, and the error-rate views in any OTel backend stay empty while the service
    // is visibly failing. No-ops when tracing is disabled or no span is active.
    const span = trace.getActiveSpan();
    if (span) {
        span.recordException(error);
        span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
    }

    sendErrorResponse({
        error: error,
        errorMessage: error.message,
        response: response,
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
    });
};

export default errorHandler;
