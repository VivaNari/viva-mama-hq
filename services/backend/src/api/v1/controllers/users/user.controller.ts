import { NextFunction, Request, Response } from "express";
import UserService from "../../../../services/users/user.service";
import { messages } from "../../../../constants/messages";
import UserModel from "../../../../models/user.model";
import { IRecommendationHistory } from "../../../../types/recommendation-history.types";
import sendResponse from "../../../../utils/commonFunctions/sendResponse";
import { StatusCodes } from "http-status-codes";
import RecommendationHistoryService from "../../../../services/recommendations/recommendation-history.service";
import recommendationHistoryModel from "../../../../models/recommendation-history.model";

const getUserService = new UserService();
const recommendationHistoryService = new RecommendationHistoryService(recommendationHistoryModel);

export default class UserController {
    getUserbyAuthToken = async (req: Request, res: Response, next: NextFunction) => {
        try {
            next(new Error("sdsdsd"));
            await getUserService.getUserbyAuthToken(req, res);
        } catch (err) {
            console.log("Hello", err);
            next(err);
        }
    };
    sendOTPToPhone = async (req: Request, res: Response) => {
        await getUserService.sendOTPToPhone(req, res);
    };
    verifyOTP = async (req: Request, res: Response) => {
        await getUserService.verifyOTP(req, res);
    };

    googleAuth = async (req: Request, res: Response) => {
        await getUserService.googleAuth(req, res);
    };

    getCheckinScoreData = async (request: Request, response: Response, next: NextFunction) => {
        if (!request.user) {
            throw new Error(messages.USER_FETCH_FAILED);
        }
        const user = await UserModel.findById(request.user._id);

        try {
            const instance: IRecommendationHistory[] = await recommendationHistoryService.find({
                filter: { userId: user?._id },
                sort: { createdAt: -1 },
                limit: 1,
                selectedKeys: ["zone", "finalScore", "week"],
            });
            sendResponse({
                data: instance,
                statusCode: StatusCodes.CREATED,
                success: true,
                message: messages.RECOMMENDATION_RETRIEVED_SUCCESS,
                response,
            });
        } catch (err) {
            next(err);
        }
    };
}
