import { NextFunction, Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import sendErrorResponse from "../utils/commonFunctions/sendErrorResponse";
import logger from "../utils/logger";

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
    logger.error(
        {
            err: error,
            code: (error as { code?: unknown }).code,
            status: (error as { status?: unknown }).status,
            method: request.method,
            path: request.originalUrl,
        },
        "Unhandled error",
    );

    sendErrorResponse({
        error: error,
        errorMessage: error.message,
        response: response,
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
    });
};

export default errorHandler;
