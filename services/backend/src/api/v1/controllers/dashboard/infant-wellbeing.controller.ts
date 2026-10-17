import { NextFunction, Request, Response } from "express";
import { StatusCodes } from "http-status-codes";

import { messages } from "../../../../constants/messages";
import InfantWellbeingService, {
    ChildNotFoundError,
} from "../../../../services/infant-wellbeing/infant-wellbeing.service";
import sendResponse from "../../../../utils/commonFunctions/sendResponse";

/**
 * The infant dashboard's wellbeing card.
 *
 * A read with no validator, like the other per-child GETs: `requestValidator` inspects
 * `req.body` only, so a schema for a query parameter would never run.
 */
export default class InfantWellbeingController {
    private service = new InfantWellbeingService();

    getInfantWellbeing = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const childId = typeof req.query.childId === "string" ? req.query.childId : "";

            if (!childId) {
                return sendResponse({
                    data: null,
                    statusCode: StatusCodes.BAD_REQUEST,
                    success: false,
                    message: messages.WELLBEING_CHILD_REQUIRED,
                    response: res,
                });
            }

            const wellbeing = await this.service.forChild(req.user._id, childId);

            return sendResponse({
                data: wellbeing,
                statusCode: StatusCodes.OK,
                success: true,
                message: messages.WELLBEING_FETCH_SUCCESS,
                response: res,
            });
        } catch (error) {
            if (error instanceof ChildNotFoundError) {
                return sendResponse({
                    data: null,
                    statusCode: StatusCodes.NOT_FOUND,
                    success: false,
                    message: messages.WELLBEING_CHILD_NOT_FOUND,
                    response: res,
                });
            }
            return next(error);
        }
    };
}
