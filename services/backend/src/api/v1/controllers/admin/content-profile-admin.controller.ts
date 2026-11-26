import { NextFunction, Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { isValidObjectId } from "mongoose";

import sendResponse from "../../../../utils/commonFunctions/sendResponse";
import {
    ContentProfileError,
    contentSearchProfileService,
} from "../../../../services/contents/content-search-profile.service";
import { IContentProfileFields } from "../../../../types/content-search-profile.types";

/** Admin review of the summaries the chatbot uses to suggest content. */
export class ContentProfileAdminController {
    private handle =
        (message: string, run: (request: Request) => Promise<unknown>) =>
        async (request: Request, response: Response, next: NextFunction) => {
            try {
                const id = request.params.contentId;
                if (id !== undefined && !isValidObjectId(id)) {
                    throw new ContentProfileError(
                        "INVALID_ID",
                        "That id is not valid",
                        StatusCodes.BAD_REQUEST,
                    );
                }
                sendResponse({
                    data: await run(request),
                    statusCode: StatusCodes.OK,
                    success: true,
                    message,
                    response,
                });
            } catch (err) {
                if (err instanceof ContentProfileError) {
                    return sendResponse({
                        data: { code: err.code },
                        statusCode: err.statusCode,
                        success: false,
                        message: err.message,
                        response,
                    });
                }
                next(err);
            }
        };

    list = this.handle("Content summaries fetched", () => contentSearchProfileService.list());

    get = this.handle("Content summary fetched", (request) =>
        contentSearchProfileService.get(String(request.params.contentId)),
    );

    generate = this.handle("Content summary generated", (request) =>
        contentSearchProfileService.generate(
            String(request.params.contentId),
            request.body.revision,
        ),
    );

    save = this.handle("Content summary saved", (request) => {
        const { revision, sourceHash, ...fields } = request.body;
        return contentSearchProfileService.save(
            String(request.params.contentId),
            revision,
            sourceHash,
            fields as IContentProfileFields,
        );
    });

    approve = this.handle("Content summary approved", (request) =>
        contentSearchProfileService.approve(
            String(request.params.contentId),
            request.body.revision,
            request.body.sourceHash,
            String(request.user?._id),
        ),
    );
}

export default new ContentProfileAdminController();
