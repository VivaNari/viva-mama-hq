import { Response } from "express";
import * as redisConfig from "../../config/redis.config";
import logger, { createModuleLogger } from "../../utils/logger";

const log = createModuleLogger(logger, "sse-bus");

/**
 * Delivers chatbot replies to the instance that holds her SSE connection.
 *
 * The API runs as several Cloud Run instances with no session affinity, so the
 * POST that produces a reply often lands on a different instance from the one
 * holding her open stream. Writing to a local map alone silently dropped those
 * replies. Every reply is published once on Redis; each instance listens and
 * writes it only if it holds that user's stream.
 *
 * Without Redis (tests, a local run without it, an outage) delivery falls back to
 * the local stream, which is exactly the old behaviour.
 */
export const SSE_DELIVER_CHANNEL = "chat:sse:deliver";

type TEnvelope = { userId: string; payload: Record<string, unknown> };

// One registry per process, shared by every ChatFlowAIService instance.
const connections = new Map<string, Response>();
let subscribed = false;

const writeFrame = (res: Response, payload: Record<string, unknown>): boolean => {
    if (res.writableEnded || res.destroyed) return false;
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
    return true;
};

const deliverLocal = (userId: string, payload: Record<string, unknown>): boolean => {
    const res = connections.get(userId);
    if (!res) return false;
    return writeFrame(res, payload);
};

const redisReady = (client: { status?: string } | undefined): boolean =>
    Boolean(client) && client!.status === "ready";

const sseBus = {
    register(userId: string, res: Response): void {
        connections.set(userId, res);
        // Only drop the entry if it is still this stream: a reconnect registers a new
        // response before the old one's close event fires.
        res.on("close", () => {
            if (connections.get(userId) === res) connections.delete(userId);
        });
    },

    getLocal(userId: string): Response | undefined {
        return connections.get(userId);
    },

    /** Subscribe this instance to the delivery channel. Safe to call more than once. */
    async initialize(): Promise<void> {
        const subscriber = redisConfig.redisSubscriber;
        if (subscribed || !subscriber) return;
        await subscriber.subscribe(SSE_DELIVER_CHANNEL);
        subscriber.on("message", (channel: string, raw: string) => {
            if (channel !== SSE_DELIVER_CHANNEL) return;
            try {
                const { userId, payload } = JSON.parse(raw) as TEnvelope;
                deliverLocal(userId, payload);
            } catch (err) {
                log.error({ err }, "Malformed SSE delivery envelope");
            }
        });
        subscribed = true;
        log.info({ channel: SSE_DELIVER_CHANNEL }, "SSE bus subscribed");
    },

    /**
     * Send one frame to her stream wherever it is held. Returns false only when it
     * is known not to have been delivered; the app's poll fallback covers the rest.
     */
    async publish(userId: string, payload: Record<string, unknown>): Promise<boolean> {
        const publisher = redisConfig.redisPublisher;
        if (subscribed && redisReady(publisher)) {
            try {
                const envelope: TEnvelope = { userId, payload };
                await publisher.publish(SSE_DELIVER_CHANNEL, JSON.stringify(envelope));
                return true;
            } catch (err) {
                log.warn({ err }, "SSE publish failed; delivering locally");
            }
        }
        return deliverLocal(userId, payload);
    },

    /** Test-only: forget registered streams and subscription state. */
    reset(): void {
        connections.clear();
        subscribed = false;
    },
};

export default sseBus;
