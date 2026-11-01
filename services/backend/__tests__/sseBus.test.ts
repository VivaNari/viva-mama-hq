/**
 * Chatbot replies reach her stream on whichever API instance holds it.
 *
 * Two "instances" are simulated by publishing from one process-wide bus while the
 * stream is registered behind it: what matters is that delivery goes through Redis
 * when it is up (so any instance can answer), and falls back to the local stream when
 * it is not (the old behaviour, never worse).
 *
 * Run:  npx jest sseBus
 */
import { EventEmitter } from "events";

const bus = new EventEmitter();
const fakeRedis = {
    redisPublisher: {
        status: "ready",
        publish: jest.fn(async (channel: string, message: string) => {
            bus.emit("message", channel, message);
            return 1;
        }),
    },
    redisSubscriber: {
        subscribe: jest.fn(async () => 1),
        on: (event: string, handler: (...args: unknown[]) => void) => bus.on(event, handler),
    },
};
jest.mock(require.resolve("../src/config/redis.config"), () => ({
    __esModule: true,
    ...fakeRedis,
}));

import { EventEmitter as ResEmitter } from "events";
import type { Response } from "express";
import sseBus, { SSE_DELIVER_CHANNEL } from "../src/services/chat-system/sse-bus.service";

const fakeResponse = () => {
    const res = new ResEmitter() as unknown as Response & { frames: string[] };
    res.frames = [];
    Object.assign(res, {
        writableEnded: false,
        destroyed: false,
        write: (chunk: string) => {
            res.frames.push(chunk);
            return true;
        },
    });
    return res;
};

beforeEach(() => {
    sseBus.reset();
    fakeRedis.redisPublisher.status = "ready";
    fakeRedis.redisPublisher.publish.mockClear();
});

it("delivers through Redis, once, to the stream that holds her connection", async () => {
    await sseBus.initialize();
    const res = fakeResponse();
    sseBus.register("u1", res);

    await sseBus.publish("u1", { type: "ai_message", id: "m1" });

    expect(fakeRedis.redisPublisher.publish).toHaveBeenCalledWith(
        SSE_DELIVER_CHANNEL,
        expect.stringContaining('"userId":"u1"'),
    );
    expect(res.frames).toEqual([`data: ${JSON.stringify({ type: "ai_message", id: "m1" })}\n\n`]);
});

it("ignores deliveries for users whose stream is elsewhere", async () => {
    await sseBus.initialize();
    const res = fakeResponse();
    sseBus.register("u1", res);

    await sseBus.publish("u2", { type: "ai_message" });

    expect(res.frames).toHaveLength(0);
});

it("falls back to the local stream when Redis is down", async () => {
    await sseBus.initialize();
    fakeRedis.redisPublisher.status = "reconnecting";
    const res = fakeResponse();
    sseBus.register("u1", res);

    const delivered = await sseBus.publish("u1", { type: "ai_message" });

    expect(delivered).toBe(true);
    expect(fakeRedis.redisPublisher.publish).not.toHaveBeenCalled();
    expect(res.frames).toHaveLength(1);
});

it("keeps the newer stream when an old one closes after a reconnect", async () => {
    const oldRes = fakeResponse();
    const newRes = fakeResponse();
    sseBus.register("u1", oldRes);
    sseBus.register("u1", newRes);

    (oldRes as unknown as ResEmitter).emit("close");

    expect(sseBus.getLocal("u1")).toBe(newRes);
    (newRes as unknown as ResEmitter).emit("close");
    expect(sseBus.getLocal("u1")).toBeUndefined();
});
