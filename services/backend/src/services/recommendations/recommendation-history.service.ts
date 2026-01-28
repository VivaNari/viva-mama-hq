import RecommendationHistoryModel from "../../models/recommendation-history.model";
import { IRecommendationHistory } from "../../types/recommendation-history.types";
import BaseService from "../base.service";

export default class RecommendationHistoryService extends BaseService<IRecommendationHistory> {
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
