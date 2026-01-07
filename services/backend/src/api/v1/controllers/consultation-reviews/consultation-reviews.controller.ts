import { NextFunction, Request, Response } from "express";
import { ConsultationReviewService } from "../../../../services/consultation-reviews/consultation-review.service";
import { messages } from "../../../../constants/messages";
import sendResponse from "../../../../utils/commonFunctions/sendResponse";
import { StatusCodes } from "http-status-codes";
import { IConsultationReview } from "../../../../types/consultation-review.types";

export class ConsultationReviewController {
    private consultationReviewService: ConsultationReviewService;
    constructor() {
        this.consultationReviewService = new ConsultationReviewService();
    }

    addConsultationReview = async (request: Request, response: Response, next: NextFunction) => {
        try {
            const { consultationId, rating, review } = request.body;
            if (!request.user) {
                throw new Error(messages.USER_FETCH_FAILED);
            }

            const payload: Partial<IConsultationReview> = {
                consultationId,
                rating,
                review: review ? review : null,
            };

            const data = await this.consultationReviewService.create(payload);

            sendResponse({
                data: data,
                statusCode: StatusCodes.CREATED,
                success: true,
                message: messages.CONSULTATION_REVIEW_SAVED_SUCCESS,
                response,
            });
        } catch (err) {
            next(err);
        }
    };
}
