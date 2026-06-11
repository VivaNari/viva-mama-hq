import Redis from "ioredis";

// Publisher - for sending messages
export const redisPublisher = new Redis({
    host: process.env.REDIS_HOST || "localhost",
    port: parseInt(process.env.REDIS_PORT || "6379"),
    password: process.env.REDIS_PASSWORD || "",
    maxRetriesPerRequest: 3,
    retryStrategy(times) {
        const delay = Math.min(times * 50, 2000);
        return delay;
    },
});

// Subscriber - for receiving messages (MUST be separate!)
export const redisSubscriber = new Redis({
    host: process.env.REDIS_HOST || "localhost",
    port: parseInt(process.env.REDIS_PORT || "6379"),
    password: process.env.REDIS_PASSWORD || "",
    maxRetriesPerRequest: 3,
    enableReadyCheck: false, // Disable ready check to avoid INFO command in subscriber mode
    retryStrategy(times) {
        const delay = Math.min(times * 50, 2000);
        return delay;
    },
});

// Connection event handlers
redisPublisher.on("connect", () => {
    console.log("Redis Publisher connected");
});

redisPublisher.on("error", (err) => {
    console.error("Redis Publisher error:", err);
});

redisSubscriber.on("connect", () => {
    console.log("Redis Subscriber connected");
});

redisSubscriber.on("error", (err) => {
    console.error("Redis Subscriber error:", err);
});
