import { transformFlowResponsesToIndicators } from "../../utils/transform-indicators.util";
import redisPublisherService from "../redis/redis-publisher.service";
import logger from "../../utils/logger";
import redisSubscriberService from "../redis/redis-subscriber.service";

/**
 * Dead letter entry for failed jobs
 */
interface DeadLetterEntry {
    type: string;
    payload: {
        userId: string;
        flowInstanceId: string;
        indicators?: any;
    };
    error: string;
    attempts: number;
    createdAt: Date;
}

/**
 * Publish result
 */
interface PublishResult {
    success: boolean;
    error?: string;
    deadLettered?: boolean;
}

/**
 * ScorePublisherService - Single Responsibility: Publish scores with retry logic
 *
 * Features:
 * - Transform flow responses to indicators
 * - Publish to Redis with retry
 * - Dead letter queue for failed jobs
 */
class ScorePublisherService {
    // Configuration
    private readonly MAX_RETRIES = 3;
    private readonly INITIAL_DELAY_MS = 1000;
    private readonly BACKOFF_MULTIPLIER = 2;

    // In-memory dead letter queue (in production, use a database)
    private deadLetterQueue: DeadLetterEntry[] = [];

    // ============================================
    // Utilities
    // ============================================

    /**
     * Sleep for specified milliseconds
     */
    private sleep(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    /**
     * Calculate delay with exponential backoff
     */
    private calculateDelay(attempt: number): number {
        return this.INITIAL_DELAY_MS * Math.pow(this.BACKOFF_MULTIPLIER, attempt);
    }

    // ============================================
    // Score Publishing
    // ============================================

    /**
     * Transform flow responses to indicators
     */
    async transformToIndicators(flowInstanceId: string): Promise<any> {
        return transformFlowResponsesToIndicators(flowInstanceId);
    }

    /**
     * Publish score job to Redis with retry
     */
    async publishScoreJob(
        userId: string,
        flowInstanceId: string,
        fcmToken: string,
    ): Promise<PublishResult> {
        let lastError: Error | null = null;

        for (let attempt = 0; attempt < this.MAX_RETRIES; attempt++) {
            try {
                // Transform responses to indicators
                const indicators = await this.transformToIndicators(flowInstanceId);

                // Publish to Redis
                await redisPublisherService.publishScoreJob(
                    userId,
                    indicators,
                    fcmToken,
                    flowInstanceId,
                );

                const message = JSON.stringify({
                    userId,
                    indicators,
                    FCM_token: fcmToken,
                    flowInstanceId,
                    timestamp: new Date().toISOString(),
                });

                await redisSubscriberService.handleScoreProcess(message);

                logger.info(
                    { userId, flowInstanceId, attempt: attempt + 1 },
                    "Score job published successfully",
                );

                return { success: true };
            } catch (error: any) {
                lastError = error;

                logger.warn(
                    {
                        error: error.message,
                        userId,
                        flowInstanceId,
                        attempt: attempt + 1,
                        maxRetries: this.MAX_RETRIES,
                    },
                    "Failed to publish score job, retrying...",
                );

                // Don't wait after last attempt
                if (attempt < this.MAX_RETRIES - 1) {
                    const delay = this.calculateDelay(attempt);
                    await this.sleep(delay);
                }
            }
        }

        // All retries exhausted - add to dead letter queue
        await this.addToDeadLetterQueue(userId, flowInstanceId, lastError!);

        return {
            success: false,
            error: lastError?.message || "Failed after max retries",
            deadLettered: true,
        };
    }

    // ============================================
    // Dead Letter Queue
    // ============================================

    /**
     * Add failed job to dead letter queue
     */
    private async addToDeadLetterQueue(
        userId: string,
        flowInstanceId: string,
        error: Error,
    ): Promise<void> {
        const entry: DeadLetterEntry = {
            type: "SCORE_JOB",
            payload: {
                userId,
                flowInstanceId,
            },
            error: error.message,
            attempts: this.MAX_RETRIES,
            createdAt: new Date(),
        };

        this.deadLetterQueue.push(entry);

        logger.error(
            { userId, flowInstanceId, error: error.message },
            "Score job added to dead letter queue",
        );

        // In production, you would also:
        // 1. Persist to database
        // 2. Send alert to monitoring system
        // 3. Notify support team
    }

    /**
     * Get dead letter queue entries
     */
    getDeadLetterQueue(): DeadLetterEntry[] {
        return [...this.deadLetterQueue];
    }

    /**
     * Get dead letter queue count
     */
    getDeadLetterCount(): number {
        return this.deadLetterQueue.length;
    }

    /**
     * Retry a dead letter entry
     */
    async retryDeadLetterEntry(index: number, fcmToken: string): Promise<PublishResult> {
        const entry = this.deadLetterQueue[index];

        if (!entry) {
            return { success: false, error: "Entry not found" };
        }

        const result = await this.publishScoreJob(
            entry.payload.userId,
            entry.payload.flowInstanceId,
            fcmToken,
        );

        if (result.success) {
            // Remove from dead letter queue
            this.deadLetterQueue.splice(index, 1);
            logger.info({ entry }, "Dead letter entry processed successfully");
        }

        return result;
    }

    /**
     * Clear dead letter queue (after manual processing)
     */
    clearDeadLetterQueue(): void {
        const count = this.deadLetterQueue.length;
        this.deadLetterQueue = [];
        logger.info({ count }, "Dead letter queue cleared");
    }

    // ============================================
    // Batch Processing
    // ============================================

    /**
     * Process multiple score jobs
     */
    async publishBatch(
        jobs: Array<{ userId: string; flowInstanceId: string; fcmToken: string }>,
    ): Promise<{ successful: number; failed: number }> {
        let successful = 0;
        let failed = 0;

        for (const job of jobs) {
            const result = await this.publishScoreJob(job.userId, job.flowInstanceId, job.fcmToken);

            if (result.success) {
                successful++;
            } else {
                failed++;
            }
        }

        logger.info({ successful, failed, total: jobs.length }, "Batch processing complete");

        return { successful, failed };
    }
}

export default ScorePublisherService;
