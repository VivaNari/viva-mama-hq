import { NextFunction, Request, Response } from "express";
import RecommendationHistoryService from "../../../../services/recommendations/recommendation-history.service";
import recommendationHistoryModel from "../../../../models/recommendation-history.model";
import sendResponse from "../../../../utils/commonFunctions/sendResponse";
import { IRecommendationHistory } from "../../../../types/recommendation-history.types";
import { StatusCodes } from "http-status-codes";
import { messages } from "../../../../constants/messages";
import UserModel from "../../../../models/user.model";
import { resolveLanguage } from "../../../../utils/i18n/localizeFlowDefinition";
import { localizeRecommendationHistory } from "../../../../utils/i18n/localizeRecommendationHistory";

export default class RecommendationhistoryController {
    private recommendationHistoryService: RecommendationHistoryService;

    constructor() {
        this.recommendationHistoryService = new RecommendationHistoryService(
            recommendationHistoryModel,
        );
    }

    getAllrecommendations = async (request: Request, response: Response, next: NextFunction) => {
        if (!request.user) {
            throw new Error(messages.USER_FETCH_FAILED);
        }
        const user = await UserModel.findById(request.user._id);
        const lang = resolveLanguage(request.query.lang, user?.preferred_language);

        try {
            const instance: IRecommendationHistory[] = await this.recommendationHistoryService.find(
                {
                    filter: { userId: user?._id },
                    sort: { createdAt: -1 },
                    populate: "recommendationId",
                },
            );
            const localized = instance.map((doc) => localizeRecommendationHistory(doc, lang));
            sendResponse({
                data: localized,
                statusCode: StatusCodes.OK,
                success: true,
                message: messages.RECOMMENDATION_RETRIEVED_SUCCESS,
                response,
            });
        } catch (err) {
            next(err);
        }
    };
    getAllFormatedRecommendations = async (
        request: Request,
        response: Response,
        next: NextFunction,
    ) => {
        if (!request.user) {
            throw new Error(messages.USER_FETCH_FAILED);
        }
        const user = await UserModel.findById(request.user._id);

        try {
            const instance: IRecommendationHistory[] = await this.recommendationHistoryService.find(
                {
                    filter: { userId: user?._id },
                    sort: { _id: -1 },
                    selectedKeys: ["finalScore", "zone", "week"],
                },
            );
            sendResponse({
                data: instance,
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
