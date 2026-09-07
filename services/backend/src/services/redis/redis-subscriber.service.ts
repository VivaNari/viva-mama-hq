import { randomUUID } from "crypto";
import { SpanStatusCode, trace } from "@opentelemetry/api";
import { REDIS_CHANNELS } from "./redis-publisher.service";
import { redisSubscriber } from "../../config/redis.config";
import ScoreRecommendationHandler from "../../handlers/score-recommendation.handler";
import { sendPushNotification } from "../../utils/sendPushNotification";
import UserModel from "../../models/user.model";
import { getScoreReadyNotification } from "../../constants/chat";
import { resolveLanguage } from "../../utils/i18n/localizeFlowDefinition";
import logger, { createWorkerLogger } from "../../utils/logger";
import { runWithContext } from "../../utils/asyncLocalStorage";

// This file previously logged entirely through console.log, which meant none of it was
// structured, none of it carried request context, and none of it reached the OpenTelemetry
// collector — the score pipeline was effectively invisible in production.
const log = createWorkerLogger(logger, "score-processor");
const tracer = trace.getTracer("redis-subscriber");

class RedisSubscriberService {
    private isInitialized = false;

    public async initialize() {
        if (this.isInitialized) {
            log.warn("Redis subscriber already initialized");
            return;
        }

        try {
            // Subscribe to processing channel
            await redisSubscriber.subscribe(REDIS_CHANNELS.SCORE_PROCESS);

            log.info({ channels: [REDIS_CHANNELS.SCORE_PROCESS] }, "Subscribed to Redis channels");

            // Set up message handler
            redisSubscriber.on("message", this.handleMessage.bind(this));

            this.isInitialized = true;
        } catch (error) {
            log.error({ err: error }, "Failed to initialize Redis subscriber");
            throw error;
        }
    }

    /**
     * Entry point for a pub/sub delivery.
     *
     * A Redis message arrives with no ambient context — there is no HTTP request to
     * inherit a correlation id or trace from — so one is established here. Everything
     * handleScoreProcess logs downstream then shares an id, and the work shows up as a
     * root span rather than vanishing between the publisher's trace and nothing.
     */
    private async handleMessage(channel: string, message: string) {
        if (channel !== REDIS_CHANNELS.SCORE_PROCESS) return;

        const jobId = randomUUID();
        await runWithContext({ correlationId: jobId, jobId, channel }, () =>
            tracer.startActiveSpan(`redis ${channel}`, async (span) => {
                try {
                    await this.handleScoreProcess(message);
                } catch (error) {
                    span.recordException(error as Error);
                    span.setStatus({ code: SpanStatusCode.ERROR });
                    throw error;
                } finally {
                    span.end();
                }
            }),
        );
    }

    // Process score calculation
    public async handleScoreProcess(message: string) {
        let userId: string;

        try {
            const data = JSON.parse(message);
            userId = data.userId;
            const indicators = data.indicators;
            const FCM_token = data.FCM_token;
            const flowInstanceId = data.flowInstanceId;

            log.info({ userId, flowInstanceId, indicators }, "Processing score");

            // Process the score and recommendation
            const result = await ScoreRecommendationHandler.process(
                userId,
                indicators,
                flowInstanceId,
            );

            // Was ~20 console.log lines of hand-formatted prose. Collapsed into one
            // structured record: the same values, but queryable in the collector and
            // atomic, so a concurrent delivery cannot interleave halfway through.
            log.info(
                {
                    userId,
                    flowInstanceId,
                    score: {
                        finalScore: result.score.finalScore,
                        zone: result.score.zone,
                        week: result.score.week,
                        breastfeeding: result.score.breastfeeding,
                        weakestCategory: result.score.weakestCategory,
                        categories: result.score.categories,
                    },
                    recommendationId: result.recommendation.id,
                },
                "Score computed",
            );

            // Send the push notification (in the user's language) notifying that
            // the score is generated.
            const user = await UserModel.findById(userId);
            const notif = getScoreReadyNotification(resolveLanguage(user?.preferred_language));
            await sendPushNotification({
                token: FCM_token,
                title: notif.title,
                body: notif.body,
                data: {
                    score: result.score.finalScore.toString(),
                },
            });
        } catch (error) {
            log.error({ err: error, userId: userId! }, "Score processing failed");
        }
    }
}

export default new RedisSubscriberService();
