// src/middleware/correlationId.middleware.ts
import { Request, Response, NextFunction } from "express";
import { v4 as uuidv4 } from "uuid";
import { runWithContext, AsyncContext } from "../utils/asyncLocalStorage";

export function correlationIdMiddleware(req: Request, res: Response, next: NextFunction): void {
    const correlationId =
        (req.headers["x-correlation-id"] as string) ||
        (req.headers["x-request-id"] as string) ||
        uuidv4();
    const requestId = (req as any).id || uuidv4();

    (req as any).correlationId = correlationId;
    (req as any).requestId = requestId;

    res.setHeader("X-Correlation-ID", correlationId);
    res.setHeader("X-Request-ID", requestId);

    const context: AsyncContext = {
        correlationId,
        requestId,
    };

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
