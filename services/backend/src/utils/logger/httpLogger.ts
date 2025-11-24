// src/logger/httpLogger.ts
import pinoHttp, { HttpLogger, Options as PinoHttpOptions } from "pino-http";
import { Logger } from "pino";
import { IncomingMessage, ServerResponse } from "http";
import { Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import { serializers } from "./serializers";

export function createHttpLogger(logger: Logger): HttpLogger {
    const options: PinoHttpOptions = {
        logger,
        serializers,
        genReqId: (req: IncomingMessage, res: ServerResponse) => {
            const existingId = (req as any).id || req.headers["x-request-id"];
            return existingId || uuidv4();
        },

        //useLevel: 'info',

        autoLogging: {
            ignore: (req: IncomingMessage) => {
                const path = (req as any).url || req.url;
                return path === "/health" || path === "/healthz" || path === "/readiness";
            },
        },

        customLogLevel: (req: IncomingMessage, res: ServerResponse, err?: Error) => {
            if (err || res.statusCode >= 500) {
                return "error";
            } else if (res.statusCode >= 400) {
                return "warn";
            } else if (res.statusCode >= 300) {
                return "info";
            }
            return "info";
        },

        customSuccessMessage: (req: IncomingMessage, res: ServerResponse) => {
            return `${req.method} ${(req as any).url || req.url} ${res.statusCode}`;
        },

        customErrorMessage: (req: IncomingMessage, res: ServerResponse, err: Error) => {
            return `${req.method} ${(req as any).url || req.url} ${res.statusCode} - ${err.message}`;
        },

        customAttributeKeys: {
            req: "request",
            res: "response",
            err: "error",
            responseTime: "duration",
        },

        customProps: (req: IncomingMessage, res: ServerResponse) => {
            return {
                userAgent: req.headers["user-agent"],
                ip: req.socket.remoteAddress,
                protocol: (req as any).protocol || "http",
                correlationId: req.headers["x-correlation-id"] || (req as any).id,
            };
        },

        redact: {
            paths: [
                "request.headers.authorization",
                "request.headers.cookie",
                'response.headers["set-cookie"]',
                "req.headers.authorization",
                "req.headers.cookie",
                'res.headers["set-cookie"]',
            ],
            censor: "[REDACTED]",
        },
    };

    return pinoHttp(options);
}

export class CustomHttpLogger {
    constructor(private logger: Logger) {}

    logRequest(req: Request) {
        const startTime = Date.now();

        (req as any)._startTime = startTime;

        this.logger.info(
            {
                type: "http_request",
                method: req.method,
                url: req.originalUrl || req.url,
                path: req.path,
                query: req.query,
                headers: {
                    "user-agent": req.headers["user-agent"],
                    "content-type": req.headers["content-type"],
                    "content-length": req.headers["content-length"],
                },
                ip: req.ip || req.socket.remoteAddress,
                protocol: req.protocol,
                correlationId: req.headers["x-correlation-id"],
                requestId: (req as any).id,
            },
            "Incoming request",
        );
    }

    logResponse(req: Request, res: Response, body?: any) {
        const duration = Date.now() - ((req as any)._startTime || Date.now());

        const logLevel = res.statusCode >= 500 ? "error" : res.statusCode >= 400 ? "warn" : "info";

        this.logger[logLevel](
            {
                type: "http_response",
                method: req.method,
                url: req.originalUrl || req.url,
                statusCode: res.statusCode,
                duration,
                contentLength: res.get("content-length"),
                correlationId: req.headers["x-correlation-id"],
                requestId: (req as any).id,
                ...(body &&
                    process.env.LOG_RESPONSE_BODY === "true" && {
                        responseBody: this.sanitizeBody(body),
                    }),
            },
            `${req.method} ${req.originalUrl} ${res.statusCode} - ${duration}ms`,
        );
    }

    logError(req: Request, error: Error, statusCode: number = 500) {
        const duration = Date.now() - ((req as any)._startTime || Date.now());

        this.logger.error(
            {
                type: "http_error",
                method: req.method,
                url: req.originalUrl || req.url,
                statusCode,
                duration,
                error: {
                    message: error.message,
                    stack: error.stack,
                    name: error.name,
                },
                correlationId: req.headers["x-correlation-id"],
                requestId: (req as any).id,
            },
            `Request error: ${error.message}`,
        );
    }

    private sanitizeBody(body: any): any {
        if (!body || typeof body !== "object") {
            return body;
        }

        const sanitized = { ...body };
        const sensitiveFields = ["password", "token", "apiKey", "secret", "creditCard"];

        sensitiveFields.forEach((field) => {
            if (field in sanitized) {
                sanitized[field] = "[REDACTED]";
            }
        });

        return sanitized;
    }
}
