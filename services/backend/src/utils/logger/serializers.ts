// src/logger/serializers.ts
import { SerializedError, SerializedRequest, SerializedResponse } from "pino";
import { IncomingMessage, ServerResponse } from "http";
import { customRedact } from "./redaction";
import { raw, Request, Response } from "express";

export function errorSerializer(err: Error): SerializedError & Record<string, any> {
    return {
        type: err.constructor.name,
        raw: err,
        message: err.message,
        stack: (err as any).stack,
        code: (err as any).code,
        statusCode: (err as any).statusCode,
        details: (err as any).details,
        // Preserve any custom error properties
        ...Object.getOwnPropertyNames(err).reduce(
            (acc, key) => {
                if (!["type", "message", "stack", "code", "statusCode"].includes(key)) {
                    acc[key] = (err as any)[key];
                }
                return acc;
            },
            {} as Record<string, any>,
        ),
    };
}

export function requestSerializer(req: Request): SerializedRequest {
    const request = req as any;

    return {
        id: request.id,
        method: req.method,
        url: req.url,
        raw: req as unknown as IncomingMessage,
        params: customRedact(request.params),
        query: customRedact(request.query),
        headers: {
            host: req.headers.host || "",
            "user-agent": req.headers["user-agent"] || "",
            "content-type": req.headers["content-type"] || "",
            "content-length": req.headers["content-length"] || "",
            referer: req.headers.referer || "",
        },
        remoteAddress: req.socket.remoteAddress || "",
        remotePort: req.socket.remotePort || 0,
    };
}

export function responseSerializer(res: Response): SerializedResponse {
    return {
        statusCode: res.statusCode,
        headers: {
            "content-type": String(res.getHeader("content-type")) || "",
            "content-length": String(res.getHeader("content-length")) || "",
        },
        raw: res as unknown as ServerResponse,
    };
}

export const serializers = {
    err: errorSerializer,
    error: errorSerializer,
    req: requestSerializer,
    res: responseSerializer,
};
