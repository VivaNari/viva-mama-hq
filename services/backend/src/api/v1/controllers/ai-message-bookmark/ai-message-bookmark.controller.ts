import { NextFunction, Request, Response } from "express";
import AIBookmarkService from "../../../../services/ai-message-bookmark/ai-message-bookmark.service";
import { StatusCodes } from "http-status-codes";
import { messages } from "../../../../constants/messages";
import messageModel from "../../../../models/message.model";
import { EAccessDenial } from "../../../../types/auth.types";
import sendResponse from "../../../../utils/commonFunctions/sendResponse";

/** A bookmark row after `populate("messageId")` — the message, not just its id. */
interface IPopulatedBookmark {
    messageId?: { userId?: unknown } | null;
}

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

            // Belt and braces. `createBookmark` now refuses a message that is not the
            // caller's, but rows written before that check exist in the live database and
            // this endpoint populates the message in full. Filtering here means the hole
            // closes for data already stored, not just for new writes.
            //
            // A null `messageId` is dropped rather than kept: populate resolves to null
            // when the message is gone, and the only way to hold a bookmark on someone
            // else's message is the hole above — so if that person has since deleted their
            // account, the dangling row is exactly the artefact we are cleaning up. The
            // app maps this list straight to `messageId` and keys the list on `_id`, so a
            // null would also crash the bookmarks screen.
            const ownBookmarks = (bookmarks as unknown as IPopulatedBookmark[]).filter(
                (bookmark) =>
                    !!bookmark.messageId &&
                    String(bookmark.messageId.userId) === String(req.user._id),
            );

            sendResponse({
                data: ownBookmarks,
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
            // The message id arrives from the client and is trusted for nothing. Without
            // this check any authenticated user could bookmark *any* message id and then
            // read the message back out of their own bookmark list, because the list
            // populates the message document in full — someone else's private AI health
            // conversation, retrieved through an endpoint that looks like it only ever
            // returns your own data.
            //
            // 404 rather than 403 on purpose: a 403 would confirm that the id exists,
            // which is most of what an enumeration attack is trying to learn.
            const message = await messageModel
                .findById(req.body.messageId)
                .select("userId")
                .lean();

            if (!message || String(message.userId) !== String(req.user._id)) {
                return sendResponse({
                    data: { code: EAccessDenial.MESSAGE_NOT_YOURS },
                    statusCode: StatusCodes.NOT_FOUND,
                    success: false,
                    message: messages.MESSAGE_NOT_FOUND,
                    response: res,
                });
            }

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
