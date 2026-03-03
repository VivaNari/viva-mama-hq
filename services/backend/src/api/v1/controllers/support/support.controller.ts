import { NextFunction, Request, Response } from "express";
import { SupportService } from "../../../../services/support/support.service";
import sendResponse from "../../../../utils/commonFunctions/sendResponse";
import { messages } from "../../../../constants/messages";

export class SupportController {
    private supportService: SupportService;
    constructor() {
        this.supportService = new SupportService();
    }

    createSupport = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const userId = req.user._id;
            const support = await this.supportService.create({ ...req.body, userId });
            sendResponse({
                data: support,
                message: messages.SUPPORT_CREATED_SUCCESS,
                success: true,
                response: res,
                statusCode: 201,
            });
        } catch (error) {
            next(error);
        }
    };

    resolveSupport = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const id = req.params.id;
            if (!id) {
                throw new Error(messages.SUPPORT_ID_NOT_PROVIDED);
            }
            const support = await this.supportService.findByIdAndUpdate({
                _id: id,
                payload: {
                    isResolved: true,
                    resolvedAt: new Date(),
                },
            });
            if (!support) {
                throw new Error(messages.SUPPORT_NOT_FOUND);
            }
            sendResponse({
                data: support,
                message: messages.SUPPORT_RESOLVED_SUCCESS,
                success: true,
                response: res,
                statusCode: 200,
            });
        } catch (err) {
            next(err);
        }
    };
}
