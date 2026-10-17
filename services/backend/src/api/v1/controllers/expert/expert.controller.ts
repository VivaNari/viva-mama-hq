import { NextFunction, Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { messages } from "../../../../constants/messages";
import { ExpertService } from "../../../../services/expert/expert.service";
import { IExpert } from "../../../../types/expert.types";
import sendResponse from "../../../../utils/commonFunctions/sendResponse";
import UserModel from "../../../../models/user.model";
import { localizeExpert, localizeExperts } from "../../../../utils/i18n/localizeExpert";
import { resolveLanguage } from "../../../../utils/i18n/localizeFlowDefinition";

export class ExpertController {
    private expertService: ExpertService;
    constructor() {
        this.expertService = new ExpertService();
    }

    public getExperts = async (request: Request, response: Response, next: NextFunction) => {
        if (!request.user) {
            throw new Error(messages.USER_FETCH_FAILED);
        }
        try {
            // Referral scoping lives in the service so the chatbot's expert
            // suggestions are validated against the exact same list.
            const filteredExperts: IExpert[] = await this.expertService.getVisibleExperts(
                String(request.user._id),
            );
            const user = await UserModel.findById(request.user._id);

            const lang = resolveLanguage(request.query?.lang as string, user?.preferred_language);
            sendResponse({
                data: localizeExperts(filteredExperts, lang),
                statusCode: StatusCodes.OK,
                success: true,
                message: messages.EXPERT_FETCH_SUCCESS,
                response,
            });
        } catch (err) {
            next(err);
        }
    };

    createExpert = async (request: Request, response: Response, next: NextFunction) => {
        try {
            if (!request.user) {
                throw new Error(messages.USER_FETCH_FAILED);
            }

            const instance: IExpert = await this.expertService.create(request.body);
            sendResponse({
                data: instance,
                statusCode: StatusCodes.CREATED,
                success: true,
                message: messages.EXPERT_SAVED_SUCCESS,
                response,
            });
        } catch (err) {
            next(err);
        }
    };
    public getExpertById = async (request: Request, response: Response, next: NextFunction) => {
        if (!request.user) {
            throw new Error(messages.USER_FETCH_FAILED);
        }
        if (!request.params.id) {
            throw new Error(messages.EXPERT_FETCH_FAILED);
        }
        try {
            // Scoped, not a raw findById: an expert hidden from this user's list must
            // not be reachable by id either. See ExpertService.getVisibleExpertById.
            const expert = await this.expertService.getVisibleExpertById(
                String(request.user._id),
                request.params.id as string,
            );
            const user = await UserModel.findById(request.user._id);
            const lang = resolveLanguage(request.query?.lang as string, user?.preferred_language);

            if (!expert) {
                return sendResponse({
                    data: {},
                    statusCode: StatusCodes.NOT_FOUND,
                    success: false,
                    message: messages.EXPERT_NOT_FOUND,
                    response,
                });
            }

            sendResponse({
                data: localizeExpert(expert, lang),
                statusCode: StatusCodes.OK,
                success: true,
                message: messages.EXPERT_FETCH_SUCCESS,
                response,
            });
        } catch (err) {
            next(err);
        }
    };
}
