import { NextFunction, Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { messages } from "../../../../constants/messages";
import { ExpertService } from "../../../../services/expert/expert.service";
import { IExpert } from "../../../../types/expert.types";
import sendResponse from "../../../../utils/commonFunctions/sendResponse";

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
            const experts: IExpert[] = await this.expertService.find({});
            sendResponse({
                data: experts,
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
            const expert: IExpert = (await this.expertService.findById({
                _id: request.params.id as string,
            })) as IExpert;
            sendResponse({
                data: expert,
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
