import { Request, Response } from "express";
import RecommendationHistoryService from "../../../../services/recommendations/recommendation-history.service";

export default class RecommendationhistoryController {
    private recommendationHistoryService: RecommendationHistoryService;

    constructor() {
        this.recommendationHistoryService = new RecommendationHistoryService();
    }
    getAllrecommendations = async (request: Request, response: Response) => {
        await this.recommendationHistoryService.getUserHistory(request, response);
    };
    getAllFormatedrecommendations = async (request: Request, response: Response) => {
        await this.recommendationHistoryService.getUserFormattedrHistory(request, response);
    };
}
