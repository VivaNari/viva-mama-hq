import { NextFunction, Request, Response } from "express";
import UserService from "../../../../services/users/user.service";
import { messages } from "../../../../constants/messages";
import UserModel from "../../../../models/user.model";
import { IRecommendationHistory } from "../../../../types/recommendation-history.types";
import sendResponse from "../../../../utils/commonFunctions/sendResponse";
import { StatusCodes } from "http-status-codes";
import RecommendationHistoryService from "../../../../services/recommendations/recommendation-history.service";
import recommendationHistoryModel from "../../../../models/recommendation-history.model";

const userService = new UserService();
const recommendationHistoryService = new RecommendationHistoryService(recommendationHistoryModel);

export default class UserController {
    getUserbyAuthToken = async (req: Request, res: Response, next: NextFunction) => {
        try {
            await userService.getUserbyAuthToken(req, res);
        } catch (err) {
            console.log(err);
            next(err);
        }
    };

    updateFCMToken = async (req: Request, res: Response, next: NextFunction) => {
        try {
            if (!req.user) {
                throw new Error(messages.USER_FETCH_FAILED);
            }
            const updatedUser = await userService.findByIdAndUpdate({
                _id: req.user._id,
                payload: {
                    FCM_token: req.body.FCM_token,
                },
            });
            sendResponse({
                data: updatedUser,
                statusCode: StatusCodes.OK,
                success: true,
                message: messages.FCM_TOKEN_UPDATED_SUCCESS,
                response: res,
            });
        } catch (err) {
            console.log(err);
            next(err);
        }
    };

    sendOTPToPhone = async (req: Request, res: Response) => {
        await userService.sendOTPToPhone(req, res);
    };
    verifyOTP = async (req: Request, res: Response) => {
        await userService.verifyOTP(req, res);
    };

    googleAuth = async (req: Request, res: Response) => {
        await userService.googleAuth(req, res);
    };

    getCheckinScoreData = async (request: Request, response: Response, next: NextFunction) => {
        if (!request.user) {
            throw new Error(messages.USER_FETCH_FAILED);
        }
        const user = await UserModel.findById(request.user._id);

        try {
            const instance: IRecommendationHistory[] = await recommendationHistoryService.find({
                filter: { userId: user?._id },
                sort: { _id: -1 },
                limit: 1,
                selectedKeys: [
                    "individualRecommendations",
                    "zone",
                    "finalScore",
                    "week",
                    "tagline",
                ],
            });
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

    updateUserData = async (req: Request, res: Response, next: NextFunction) => {
        try {
            if (!req.user) {
                throw new Error(messages.USER_FETCH_FAILED);
            }
            const updatedUser = await userService.findByIdAndPartialUpdate({
                _id: req.user._id,
                payload: req.body,
            });
            sendResponse({
                data: updatedUser,
                statusCode: StatusCodes.OK,
                success: true,
                message: messages.USER_UPDATED_SUCCESS,
                response: res,
            });
        } catch (err) {
            console.log(err);
            next(err);
        }
    };
}
