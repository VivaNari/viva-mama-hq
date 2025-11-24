import { redisPublisher } from "../../config/redis.config";

export const REDIS_CHANNELS = {
    SCORE_PROCESS: "score:process",
    SCORE_COMPLETED: "score:completed",
    SCORE_ERROR: "score:error",
} as const;

class RedisPublisherService {
    // Publish score processing job
    public async publishScoreJob(
        userId: string,
        indicators: { physical: number[]; lactation: number[]; emotional: number[] },
        FCM_token: string,
    ) {
        const message = JSON.stringify({
            userId,
            indicators,
            FCM_token,
            timestamp: new Date().toISOString(),
        });

        try {
            const subscriberCount = await redisPublisher.publish(
                REDIS_CHANNELS.SCORE_PROCESS,
                message,
            );

            console.log(
                `Published score job for user ${userId} (${subscriberCount} subscribers listening)`,
            );

            return { success: true, subscriberCount };
        } catch (error) {
            console.error("Failed to publish score job:", error);
            throw error;
        }
    }
}

export default new RedisPublisherService();
