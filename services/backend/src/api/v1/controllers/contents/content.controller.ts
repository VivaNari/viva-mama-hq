import { NextFunction, Request, Response } from "express";
import { ContentService } from "../../../../services/contents/content.service";
import { IContent } from "../../../../types/content.types";
import sendResponse from "../../../../utils/commonFunctions/sendResponse";
import { StatusCodes } from "http-status-codes";
import { messages } from "../../../../constants/messages";
import UserModel from "../../../../models/user.model";
import { IUser } from "../../../../types";

export class ContentController {
    private contentService: ContentService = new ContentService();
    constructor() {
        this.contentService = new ContentService();
    }

    public getContents = async (request: Request, response: Response, next: NextFunction) => {
        if (!request.user) {
            throw new Error(messages.USER_FETCH_FAILED);
        }
        const user = (await UserModel.findById(request.user._id)) as IUser;
        try {
            const contents: IContent[] = await this.contentService.find({
                filter: {
                    category: user.user_category,
                    validWeeks: { $in: [user.current_weekdays.weeks] },
                },
            });
            sendResponse({
                data: contents,
                statusCode: StatusCodes.OK,
                success: true,
                message: messages.CONTENT_FETCH_SUCCESS,
                response,
            });
        } catch (err) {
            next(err);
        }
    };

    createContent = async (request: Request, response: Response, next: NextFunction) => {
        try {
            if (!request.user) {
                throw new Error(messages.USER_FETCH_FAILED);
            }

            const instance: IContent = await this.contentService.create(request.body);
            sendResponse({
                data: instance,
                statusCode: StatusCodes.CREATED,
                success: true,
                message: messages.CONTENT_SAVED_SUCCESS,
                response,
            });
        } catch (err) {
            next(err);
        }
    };
}
