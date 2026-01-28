import { NextFunction, Request, Response } from "express";
import AIBookmarkService from "../../../../services/ai-message-bookmark/ai-message-bookmark.service";
import { StatusCodes } from "http-status-codes";
import { messages } from "../../../../constants/messages";
import sendResponse from "../../../../utils/commonFunctions/sendResponse";

export default class AIBookmarkController {
    private aiBookmarkService: AIBookmarkService;
    constructor() {
        this.aiBookmarkService = new AIBookmarkService();
    }

    getUserBookmarks = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const bookmarks = await this.aiBookmarkService.find({
                filter: {
                    userId: req.user._id,
                },
                sort: {
                    _id: -1,
                },
                populate: "messageId",
            });
            sendResponse({
                data: bookmarks,
                statusCode: StatusCodes.OK,
                success: true,
                message: messages.BOOKMARK_FETCH_SUCCESS,
                response: res,
            });
        } catch (err) {
            console.log(err);
            next(err);
        }
    };

    createBookmark = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const aiBookmarkInstance = await this.aiBookmarkService.create({
                userId: req.user._id,
                messageId: req.body.messageId,
            });
            sendResponse({
                data: aiBookmarkInstance,
                statusCode: StatusCodes.OK,
                success: true,
                message: messages.BOOKMARK_CREATED_SUCCESS,
                response: res,
            });
        } catch (err) {
            console.log(err);
            next(err);
        }
    };

    deleteBookmark = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const deletedBookmarkInstance = await this.aiBookmarkService.delete({
                filter: {
                    userId: req.user._id,
                    messageId: req.body.messageId,
                },
            });
            sendResponse({
                data: deletedBookmarkInstance,
                statusCode: StatusCodes.OK,
                success: true,
                message: messages.BOOKMARK_DELETED_SUCCESS,
                response: res,
            });
        } catch (err) {
            console.log(err);
            next(err);
        }
    };
}
