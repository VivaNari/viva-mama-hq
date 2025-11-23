import { NextFunction, Request, Response } from "express";
import sendResponse from "../../../../utils/commonFunctions/sendResponse";
import { StatusCodes } from "http-status-codes";
import { messages } from "../../../../constants/messages";
import RecommendationService from "../../../../services/recommendations/recommendation.service";
import { IRecommendation } from "../../../../types/recommendation.types";

class RecommendationController {
    private recommendationService: RecommendationService;

    constructor() {
        this.recommendationService = new RecommendationService();
    }

    create = async (request: Request, response: Response, next: NextFunction) => {
        try {
            const instance: IRecommendation = await this.recommendationService.create(request.body);
            sendResponse({
                data: instance,
                statusCode: StatusCodes.CREATED,
                success: true,
                message: messages.RECOMMENDATION_SAVED_SUCCESS,
                response,
            });
        } catch (err) {
            next(err);
        }
    };

    find = async (request: Request, response: Response, next: NextFunction) => {
        try {
            const instances: IRecommendation[] = await this.recommendationService.find(
                request.body,
            );
            sendResponse({
                data: instances,
                statusCode: StatusCodes.OK,
                success: true,
                message: messages.RECOMMENDATION_RETRIEVED_SUCCESS,
                response,
            });
        } catch (err) {
            next(err);
        }
    };
}

export default RecommendationController;
