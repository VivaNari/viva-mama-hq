import { Request, Response, NextFunction } from "express";
import { httpLogger } from "../utils/logger";

export const requestLoggerMiddleware = httpLogger;

export function conditionalRequestLogger(options?: {
    excludePaths?: string[];
    excludeHealthChecks?: boolean;
    logRequestBody?: boolean;
    logResponseBody?: boolean;
}) {
    const {
        excludePaths = [],
        excludeHealthChecks = true,
        logRequestBody = false,
        logResponseBody = false,
    } = options || {};

    const healthCheckPaths = ["/health", "/healthz", "/readiness", "/liveness"];
    const pathsToExclude = excludeHealthChecks
        ? [...excludePaths, ...healthCheckPaths]
        : excludePaths;

    return (req: Request, res: Response, next: NextFunction) => {
        if (pathsToExclude.some((path) => req.path === path)) {
            return next();
        }

        return httpLogger(req, res, next);
    };
}

export function requestBodyLogger(req: Request, res: Response, next: NextFunction) {
    if (req.method !== "GET" && req.method !== "HEAD") {
        req.log.info(
            {
                requestBody: req.body,
                contentType: req.headers["content-type"],
            },
            "Request body",
        );
    }
    next();
}

export function responseBodyLogger(req: Request, res: Response, next: NextFunction) {
    const originalSend = res.send;
    res.send = function (body: any): Response {
        if (res.statusCode >= 400 || process.env.NODE_ENV !== "production") {
            req.log.info(
                {
                    responseBody: typeof body === "string" ? body.substring(0, 1000) : body,
                    statusCode: res.statusCode,
                },
                "Response body",
            );
        }
        return originalSend.call(this, body);
    };

    next();
}
