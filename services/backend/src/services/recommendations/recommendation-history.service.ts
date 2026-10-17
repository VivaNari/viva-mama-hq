import RecommendationHistoryModel from "../../models/recommendation-history.model";
import { IRecommendationHistory } from "../../types/recommendation-history.types";
import BaseService from "../base.service";

export default class RecommendationHistoryService extends BaseService<IRecommendationHistory> {
    /**
     * Mark this week's emergency alert as dismissed.
     *
     * Filtered on `userId` as well as `_id` on purpose — matching on the id
     * alone would let any authenticated user dismiss another user's alert.
     * Returns null when nothing matched, which the caller turns into a 404.
     */
    public async dismissAlert(
        id: string,
        userId: string,
    ): Promise<IRecommendationHistory | null> {
        return RecommendationHistoryModel.findOneAndUpdate(
            { _id: id, userId },
            { $set: { alertDismissedAt: new Date() } },
            { new: true },
        ).lean();
    }

    public static async createRH(data: IRecommendationHistory) {
        try {
            const history = await RecommendationHistoryModel.create(data);
            console.log(`Recommendation history saved for user ${data.userId}`);
            return history;
        } catch (error) {
            console.error("Error saving recommendation history:", error);
            throw error;
        }
    }
}
