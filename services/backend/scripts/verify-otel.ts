/**
 * Manual end-to-end check for the OpenTelemetry log pipeline.
 *
 * Run against a collector (the real one, or scratchpad/fake-collector.cjs):
 *
 *   OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318 OTEL_AUTH_MODE=none \
 *   OTEL_TRACES_ENABLED=true SERVICE_NAME=vivamama-backend \
 *   npx ts-node scripts/verify-otel.ts
 *
 * Proves four things that are easy to get silently wrong:
 *   1. records reach the collector at all
 *   2. child logger bindings (component/module) survive as attributes
 *   3. the mixin resolves AsyncLocalStorage live, from a logger built at import time
 *   4. trace context is attached per record, not frozen per child
 */
import "../src/telemetry";

import { trace } from "@opentelemetry/api";
import logger, { createModuleLogger, createWorkerLogger } from "../src/utils/logger";
import { runWithContext } from "../src/utils/asyncLocalStorage";
import { runShutdownHooks } from "../src/utils/shutdownRegistry";

// Deliberately created at module scope, which is the case that was broken before: the old
// childLogger snapshotted an empty AsyncLocalStorage here and repeated it forever.
const log = createModuleLogger(logger, "verify-otel");

async function main(): Promise<void> {
    log.info("no request context — correlationId should be absent");

    runWithContext({ correlationId: "corr-abc-123", requestId: "req-xyz-789" }, () => {
        log.info("inside request context — correlationId should be present");
    });

    const tracer = trace.getTracer("verify-otel");
    await tracer.startActiveSpan("verify-span", async (span) => {
        runWithContext({ correlationId: "corr-in-span", userId: "user-42" }, () => {
            log.info("inside a span — trace_id and span_id should be set");
        });
        span.end();
    });

    const worker = createWorkerLogger(logger, "score-processor", "job-7");
    worker.warn("worker logger — worker/jobId should appear as attributes");

    log.error({ err: new Error("boom") }, "error record — severity should be ERROR");

    // Same drain path the SIGTERM handler uses.
    await runShutdownHooks();
}

void main();
