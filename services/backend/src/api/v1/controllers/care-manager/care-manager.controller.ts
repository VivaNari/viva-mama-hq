import { NextFunction, Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { messages } from "../../../../constants/messages";
import { CareManagerService } from "../../../../services/care-manager/care-manager.service";
import { ICareManager } from "../../../../types/care-manager.types";
import sendResponse from "../../../../utils/commonFunctions/sendResponse";

export class CareManagerController {
    private careManagerService: CareManagerService;
    constructor() {
        this.careManagerService = new CareManagerService();
    }

    public getCareManagers = async (request: Request, response: Response, next: NextFunction) => {
        if (!request.user) {
            throw new Error(messages.USER_FETCH_FAILED);
        }
        try {
            const careManagers: ICareManager[] = await this.careManagerService.find({});
            sendResponse({
                data: careManagers,
                statusCode: StatusCodes.OK,
                success: true,
                message: messages.CARE_MANAGER_FETCH_SUCCESS,
                response,
            });
        } catch (err) {
            next(err);
        }
    };

    public createCareManager = async (request: Request, response: Response, next: NextFunction) => {
        try {
            if (!request.user) {
                throw new Error(messages.USER_FETCH_FAILED);
            }

            const instance: ICareManager = await this.careManagerService.create(request.body);
            sendResponse({
                data: instance,
                statusCode: StatusCodes.CREATED,
                success: true,
                message: messages.CARE_MANAGER_SAVED_SUCCESS,
                response,
            });
        } catch (err) {
            next(err);
        }
    };

    public getCareManagerById = async (
        request: Request,
        response: Response,
        next: NextFunction,
    ) => {
        if (!request.user) {
            throw new Error(messages.USER_FETCH_FAILED);
        }
        if (!request.params.id) {
            throw new Error(messages.CARE_MANAGER_NOT_FOUND);
        }
        try {
            const careManager: ICareManager = (await this.careManagerService.findById({
                _id: request.params.id,
            })) as ICareManager;
            sendResponse({
                data: careManager,
                statusCode: StatusCodes.OK,
                success: true,
                message: messages.CARE_MANAGER_FETCH_SUCCESS,
                response,
            });
        } catch (err) {
            next(err);
        }
    };
}
