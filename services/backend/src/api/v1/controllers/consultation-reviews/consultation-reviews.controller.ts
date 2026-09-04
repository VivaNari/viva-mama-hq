import { NextFunction, Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { isValidObjectId } from "mongoose";
import { messages } from "../../../../constants/messages";
import { ConsultationReviewService } from "../../../../services/consultation-reviews/consultation-review.service";
import { ConsultationService } from "../../../../services/consultations/consultation.service";
import { IConsultationReview } from "../../../../types/consultation-review.types";
import sendResponse from "../../../../utils/commonFunctions/sendResponse";

export class ConsultationReviewController {
    private consultationReviewService: ConsultationReviewService;
    private consultationService: ConsultationService;
    constructor() {
        this.consultationReviewService = new ConsultationReviewService();
        this.consultationService = new ConsultationService();
    }

    createConsultationReview = async (request: Request, response: Response, next: NextFunction) => {
        try {
            const { consultationId, rating, review } = request.body;

            if (!request.user) {
                throw new Error(messages.USER_FETCH_FAILED);
            }

            // The id arrives from a push payload, so the booking is confirmed to be the
            // caller's own before anything is written against it.
            const consultation: any = isValidObjectId(consultationId)
                ? await this.consultationService.findById({ _id: consultationId })
                : null;

            if (!consultation || consultation.userId.toString() !== request.user._id.toString()) {
                return sendResponse({
                    data: {},
                    statusCode: StatusCodes.NOT_FOUND,
                    success: false,
                    message: messages.CONSULTATION_NOT_FOUND,
                    response,
                });
            }

            // One rating per consultation. A double tap on Submit, or a second visit
            // through the same notification, must not stack duplicate rows that would
            // skew the consultant's average.
            const existingReview = await this.consultationReviewService.findOne({
                filter: { consultationId },
            });

            if (existingReview) {
                return sendResponse({
                    data: existingReview,
                    statusCode: StatusCodes.CONFLICT,
                    success: false,
                    message: messages.CONSULTATION_ALREADY_REVIEWED,
                    response,
                });
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
