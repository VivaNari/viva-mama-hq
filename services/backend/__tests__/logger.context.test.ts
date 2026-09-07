/**
 * Regression tests for how request context reaches a log line.
 *
 * The bug these pin down: createChildLogger used to read AsyncLocalStorage at the moment
 * the child was created and hand the result to pino as child bindings. pino pre-serialises
 * bindings into a string, so a logger built at module scope — which is exactly what
 * `const log = createModuleLogger(logger, "x")` at the top of a file does — captured an
 * empty context at import time and repeated it for the life of the process. Every
 * correlationId was silently missing from the logs, and from the OTel records built from
 * them.
 *
 * The fix moved context to a pino `mixin`, evaluated per record. These tests write through
 * a real pino instance to an in-memory stream, because the behaviour under test is
 * serialisation-time behaviour: asserting on a mock logger would prove nothing.
 */
import { Writable } from "stream";
import pino from "pino";

import { createModuleLogger, createWorkerLogger } from "../src/utils/logger/childLogger";
import { getAsyncContext, runWithContext } from "../src/utils/asyncLocalStorage";

function createCapturingLogger(): { logger: pino.Logger; lines: () => Record<string, any>[] } {
    const captured: string[] = [];
    const stream = new Writable({
        write(chunk, _encoding, callback) {
            captured.push(chunk.toString());
            callback();
        },
    });

    // Mirrors the mixin in src/utils/logger/pino.config.ts. Reproduced rather than imported
    // because pino.config reads env at import time and registers process-wide signal
    // handlers, neither of which belongs in a unit test.
    const logger = pino(
        {
            level: "info",
            base: { service: "test-service" },
            mixin: () => ({ ...getAsyncContext() }),
        },
        stream,
    );

    return {
        logger,
        lines: () =>
            captured
                .join("")
                .split("\n")
                .filter(Boolean)
                .map((line) => JSON.parse(line)),
    };
}

describe("logger request context", () => {
    it("omits correlation fields when there is no ambient context", () => {
        const { logger, lines } = createCapturingLogger();
        const log = createModuleLogger(logger, "billing");

        log.info("no context");

        const [record] = lines();
        expect(record).toMatchObject({ component: "billing", module: "billing" });
        expect(record).not.toHaveProperty("correlationId");
    });

    it("picks up context established AFTER the child logger was created", () => {
        const { logger, lines } = createCapturingLogger();

        // Created first, outside any context — the module-scope case that used to freeze
        // an empty snapshot.
        const log = createModuleLogger(logger, "billing");

        runWithContext({ correlationId: "corr-1", requestId: "req-1" }, () => {
            log.info("in context");
        });

        const [record] = lines();
        expect(record).toMatchObject({
            component: "billing",
            correlationId: "corr-1",
            requestId: "req-1",
        });
    });

    it("resolves context per record, not once per logger", () => {
        const { logger, lines } = createCapturingLogger();
        const log = createModuleLogger(logger, "billing");

        runWithContext({ correlationId: "first" }, () => log.info("a"));
        runWithContext({ correlationId: "second" }, () => log.info("b"));
        log.info("c");

        const records = lines();
        expect(records[0]).toMatchObject({ correlationId: "first" });
        expect(records[1]).toMatchObject({ correlationId: "second" });
        expect(records[2]).not.toHaveProperty("correlationId");
    });

    it("keeps static worker bindings on every record", () => {
        const { logger, lines } = createCapturingLogger();
        const log = createWorkerLogger(logger, "score-processor", "job-9");

        runWithContext({ correlationId: "corr-2" }, () => log.info("working"));

        const [record] = lines();
        expect(record).toMatchObject({
            component: "score-processor",
            worker: "score-processor",
            jobId: "job-9",
            correlationId: "corr-2",
        });
    });

    it("preserves base bindings that the root formatter used to discard", () => {
        // The bindings formatter in pino.config.ts rebuilt the object from scratch and
        // dropped service/env/version. This asserts the shape a child inherits.
        const { logger, lines } = createCapturingLogger();
        createModuleLogger(logger, "billing").info("hello");

        expect(lines()[0]).toMatchObject({ service: "test-service", component: "billing" });
    });
});
