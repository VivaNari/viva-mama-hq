// src/middleware/correlationId.middleware.ts
import { Request, Response, NextFunction } from "express";
import { v4 as uuidv4 } from "uuid";
import { trace } from "@opentelemetry/api";
import { runWithContext, AsyncContext } from "../utils/asyncLocalStorage";

/**
 * Correlation id for this request, preferring an id that already means something to
 * someone else.
 *
 * Order: an explicit inbound header (a caller that already has an id wins, so a trace
 * spanning services keeps one value), then the active OpenTelemetry trace id, then a
 * fresh uuid.
 *
 * Reusing the trace id is what stops correlation and tracing being two parallel
 * universes: with tracing enabled, the id in the response header, the id on every log
 * line, and the id in the collector are the same string, so a support ticket quoting
 * X-Correlation-ID leads straight to the trace. With tracing disabled there is no active
 * span and this falls through to the uuid, exactly as before.
 */
function resolveCorrelationId(req: Request): string {
    const fromHeader =
        (req.headers["x-correlation-id"] as string) || (req.headers["x-request-id"] as string);
    if (fromHeader) return fromHeader;

    const spanContext = trace.getActiveSpan()?.spanContext();
    if (spanContext?.traceId) return spanContext.traceId;

    return uuidv4();
}

export function correlationIdMiddleware(req: Request, res: Response, next: NextFunction): void {
    const correlationId = resolveCorrelationId(req);
    const requestId = (req as any).id || uuidv4();

    (req as any).correlationId = correlationId;
    (req as any).requestId = requestId;

    res.setHeader("X-Correlation-ID", correlationId);
    res.setHeader("X-Request-ID", requestId);

    const context: AsyncContext = {
        correlationId,
        requestId,
    };

    // Also stamp the span, so a trace can be found from a correlation id and vice versa.
    // No-ops when tracing is disabled.
    trace.getActiveSpan()?.setAttributes({
        "correlation.id": correlationId,
        "request.id": requestId,
    });

    // Run the rest of the request handling within this context
    runWithContext(context, () => {
        next();
    });
}

/**
 * Enhanced correlation middleware with user context
 * Extracts user information from authenticated requests
 */
export function enhancedCorrelationMiddleware(
    req: Request,
    res: Response,
    next: NextFunction,
): void {
    const correlationId =
        (req.headers["x-correlation-id"] as string) ||
        (req.headers["x-request-id"] as string) ||
        uuidv4();

    const requestId = (req as any).id || uuidv4();

    const userId = (req as any).user?.id || (req as any).userId;
    const sessionId = (req as any).session?.id || (req as any).sessionId;

    (req as any).correlationId = correlationId;
    (req as any).requestId = requestId;

    res.setHeader("X-Correlation-ID", correlationId);
    res.setHeader("X-Request-ID", requestId);

    const context: AsyncContext = {
        correlationId,
        requestId,
        ...(userId && { userId }),
        ...(sessionId && { sessionId }),
        userAgent: req.headers["user-agent"],
        ip: req.ip || req.socket.remoteAddress,
        method: req.method,
        path: req.path,
    };

    runWithContext(context, () => {
        next();
    });
}
