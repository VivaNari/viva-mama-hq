/**
 * End-to-end check of the HTTP path: span creation, correlation-id unification, log/trace
 * correlation, and error recording — using the real middleware, not stubs.
 *
 *   OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318 OTEL_AUTH_MODE=none \
 *   OTEL_TRACES_ENABLED=true npx ts-node scripts/verify-otel-http.ts
 *
 * Deliberately does not boot src/app.ts, which needs Mongo and Redis. The subject here is
 * the telemetry wiring, so it mounts the same middleware on a bare express app.
 */
import "../src/telemetry";

import express from "express";
import http from "http";
import { correlationIdMiddleware } from "../src/middlewares/correlationId.middleware";
import errorHandler from "../src/middlewares/errorHandler.middleware";
import logger, { createModuleLogger } from "../src/utils/logger";
import { runShutdownHooks } from "../src/utils/shutdownRegistry";

const log = createModuleLogger(logger, "verify-http");

const app = express();
app.use(correlationIdMiddleware);

app.get("/health", (_req, res) => {
    log.info("health check — should NOT produce a span");
    res.json({ status: "ok" });
});

app.get("/ok", (_req, res) => {
    log.info("handling /ok — should carry trace_id and correlationId");
    res.json({ ok: true });
});

app.get("/boom", () => {
    throw new Error("deliberate failure");
});

app.use(errorHandler);

function get(port: number, path: string): Promise<{ status: number; headers: http.IncomingHttpHeaders }> {
    return new Promise((resolve, reject) => {
        const req = http.get({ host: "127.0.0.1", port, path }, (res) => {
            res.resume();
            res.on("end", () => resolve({ status: res.statusCode || 0, headers: res.headers }));
        });
        req.on("error", reject);
    });
}

async function main(): Promise<void> {
    const server = app.listen(0);
    await new Promise((r) => server.once("listening", r));
    const port = (server.address() as { port: number }).port;

    const ok = await get(port, "/ok");
    console.log("GET /ok ->", ok.status, "X-Correlation-ID:", ok.headers["x-correlation-id"]);

    const health = await get(port, "/health");
    console.log("GET /health ->", health.status);

    const boom = await get(port, "/boom");
    console.log("GET /boom ->", boom.status, "X-Correlation-ID:", boom.headers["x-correlation-id"]);

    server.close();
    await runShutdownHooks();
}

void main();
