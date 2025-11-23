import { REDIS_CHANNELS } from "./redis-publisher.service";
import { redisSubscriber } from "../../config/redis.config";
import ScoreRecommendationHandler from "../../api/v1/handlers/score-recommendation.handler";
import { sendPushNotification } from "../../utils/sendPushNotification";

class RedisSubscriberService {
    private isInitialized = false;

    public async initialize() {
        if (this.isInitialized) {
            console.log("Redis subscriber already initialized");
            return;
        }

        try {
            // Subscribe to processing channel
            await redisSubscriber.subscribe(REDIS_CHANNELS.SCORE_PROCESS);

            console.log("Subscribed to Redis channels:");
            console.log(`- ${REDIS_CHANNELS.SCORE_PROCESS}`);

            // Set up message handler
            redisSubscriber.on("message", this.handleMessage.bind(this));

            this.isInitialized = true;
        } catch (error) {
            console.error("Failed to initialize Redis subscriber:", error);
            throw error;
        }
    }

    // Handle incoming messages
    private async handleMessage(channel: string, message: string) {
        if (channel === REDIS_CHANNELS.SCORE_PROCESS) {
            await this.handleScoreProcess(message);
        }
    }

    // Process score calculation
    private async handleScoreProcess(message: string) {
        let userId: string;

        try {
            const data = JSON.parse(message);
            userId = data.userId;
            const indicators = data.indicators;
            const FCM_token = data.FCM_token;

            console.log(`[WORKER] Processing score for user ${userId}...`);
            console.log(`[WORKER] Indicators:`, JSON.stringify(indicators, null, 2));

            // Process the score and recommendation
            const result = await ScoreRecommendationHandler.process(userId, indicators);

            // TODO: Now send the score and recommendation back to the user via push notification

            console.log(`\nSCORE DETAILS:`);
            console.log(`   Final Score: ${result.score.finalScore}%`);
            console.log(`   Zone: ${result.score.zone}`);
            console.log(`   Week: ${result.score.week}`);
            console.log(`   Breastfeeding: ${result.score.breastfeeding}`);
            console.log(`   Weakest Category: ${result.score.weakestCategory}`);
            console.log(`\nCATEGORY BREAKDOWN:`);
            console.log(`   Physical:`);
            console.log(`      Raw: ${result.score.categories.physical.raw}`);
            console.log(`      Weighted: ${result.score.categories.physical.weighted}`);
            console.log(`   Lactation:`);
            console.log(`      Raw: ${result.score.categories.lactation.raw}`);
            console.log(`      Weighted: ${result.score.categories.lactation.weighted}`);
            console.log(`   Emotional:`);
            console.log(`      Raw: ${result.score.categories.emotional.raw}`);
            console.log(`      Weighted: ${result.score.categories.emotional.weighted}`);
            console.log(`\nRECOMMENDATION:`);
            console.log(`   ID: ${result.recommendation.id}`);
            console.log(`   Message:\n${result.recommendation.message}`);

            // Send the push notification to the user notifying that the score is generated.
            await sendPushNotification({
                token: FCM_token,
                title: "Your new Viva Score is available!",
                body: "Tap to view your personalized recommendations and insights.",
                data: {
                    score: result.score.finalScore.toString(),
                },
            });
        } catch (error) {
            console.error(`[WORKER] Score processing failed for user ${userId!}:`, error);
        }
    }
}

export default new RedisSubscriberService();
