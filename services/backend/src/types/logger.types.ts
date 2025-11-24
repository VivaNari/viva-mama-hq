import { Logger } from "pino";

export interface LogContext {
    correlationId?: string;
    userId?: string;
    sessionId?: string;
    requestId?: string;
    traceId?: string;
    spanId?: string;
    [key: string]: any;
}

export interface AppLoggerOptions {
    name?: string;
    context?: LogContext;
}

export type AppLogger = Logger;

export enum LogLevel {
    FATAL = "fatal",
    ERROR = "error",
    WARN = "warn",
    INFO = "info",
    DEBUG = "debug",
    TRACE = "trace",
}

export interface ErrorLog {
    error: Error;
    context?: Record<string, any>;
    stack?: string;
    code?: string;
    statusCode?: number;
}

export interface MetricLog {
    metric: string;
    value: number;
    unit?: string;
    tags?: Record<string, string>;
}

export interface AuditLog {
    action: string;
    actor: string;
    resource: string;
    outcome: "success" | "failure";
    metadata?: Record<string, any>;
}
