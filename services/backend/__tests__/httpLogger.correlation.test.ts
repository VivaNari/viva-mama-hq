/**
 * Regression test for duplicate `correlationId` keys on HTTP request logs.
 *
 * The bug: pino-http's `customProps` emitted `correlationId`, and the root logger's mixin
 * emitted it too. Both land in the same JSON object, so the serialised line contained the
 * key twice. That is legal JSON, and most parsers quietly take the last value — but Cloud
 * Logging CONCATENATES duplicate keys, so every request log in production carried a
 * 72-character mash of two different UUIDs and the field could not be searched:
 *
 *   correlationId: '77f01daf-185e-495b-a38f-230c967784dd269963a6-87da-434d-99bb-a0783d37f107'
 *
 * A `toMatchObject` assertion would NOT have caught this — by the time JSON.parse runs the
 * duplicate is already collapsed. The test therefore inspects the raw serialised line and
 * counts key occurrences, which is the only place the defect is visible.
 */
import { Writable } from "stream";
import pino from "pino";
import pinoHttp from "pino-http";
import { IncomingMessage, ServerResponse } from "http";
import { Socket } from "net";

import { runWithContext, getAsyncContext } from "../src/utils/asyncLocalStorage";

function countKeyOccurrences(line: string, key: string): number {
    return line.split(`"${key}":`).length - 1;
}

function createHarness() {
    const lines: string[] = [];
    const stream = new Writable({
        write(chunk, _enc, cb) {
            lines.push(chunk.toString());
            cb();
        },
    });

    // Mirrors the root logger's mixin. Reproduced rather than imported because
    // pino.config.ts reads env and registers process-wide signal handlers at import time.
    const logger = pino({ level: "info", mixin: () => ({ ...getAsyncContext() }) }, stream);

    // The same customProps shape the app uses. If someone re-adds correlationId here, this
    // test fails.
    const middleware = pinoHttp({
        logger,
        customProps: (req: IncomingMessage) => ({
            userAgent: req.headers["user-agent"],
            ip: req.socket?.remoteAddress,
        }),
    });

    return { lines, middleware };
}

function fakeReqRes(): { req: IncomingMessage; res: ServerResponse } {
    const req = new IncomingMessage(new Socket());
    req.method = "GET";
    req.url = "/api/v1/thing";
    const res = new ServerResponse(req);
    res.statusCode = 200;
    return { req, res };
}

describe("http request logs", () => {
    it("emits exactly one correlationId per record", () => {
        const { lines, middleware } = createHarness();
        const { req, res } = fakeReqRes();

        runWithContext({ correlationId: "corr-from-als", requestId: "req-1" }, () => {
            middleware(req, res);
            res.emit("finish");
        });

        expect(lines.length).toBeGreaterThan(0);
        const line = lines[0] as string;

        // The assertion that matters: raw text, before JSON.parse collapses duplicates.
        expect(countKeyOccurrences(line, "correlationId")).toBe(1);

        // And the surviving value is the request-context one, not pino-http's own req.id.
        expect(JSON.parse(line).correlationId).toBe("corr-from-als");
    });

    it("does not invent a correlationId when there is no request context", () => {
        const { lines, middleware } = createHarness();
        const { req, res } = fakeReqRes();

        middleware(req, res);
        res.emit("finish");

        const line = lines[0] as string;
        expect(countKeyOccurrences(line, "correlationId")).toBe(0);
    });
});
