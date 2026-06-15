import { NextFunction, Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { messages } from "../../../../constants/messages";
import { ConsultationService } from "../../../../services/consultations/consultation.service";
import { CallbackRequestStatusEnum } from "../../../../types/consultation.types";
import sendResponse from "../../../../utils/commonFunctions/sendResponse";

export class ConsultationController {
    private consultationService: ConsultationService;

    constructor() {
        this.consultationService = new ConsultationService();
    }

    requestCallback = async (request: Request, response: Response, next: NextFunction) => {
        try {
            const { consultatorId, preferred_consultation_date } = request.body;
            const userId = request.user._id;

            const result = await this.consultationService.requestCallback(
                userId,
                consultatorId,
                preferred_consultation_date,
            );

            sendResponse({
                data: result,
                statusCode: StatusCodes.CREATED,
                success: true,
                message: messages.CONSULTATION_SAVED_SUCCESS,
                response,
            });
        } catch (err) {
            next(err);
        }
    };

    completeConsultation = async (request: Request, response: Response, next: NextFunction) => {
        try {
            const userId = request.user._id;
            const id = request.params.id as string;
            if (!id) {
                throw new Error(messages.CONSULTATION_ID_NOT_PROVIDED);
            }
            const consultationInstance = await this.consultationService.completeConsultation(
                userId,
                id,
            );

            sendResponse({
                data: consultationInstance,
                statusCode: StatusCodes.OK,
                success: true,
                message: messages.CONSULTATION_COMPLETED_SUCCESS,
                response,
            });
        } catch (err) {
            next(err);
        }
    };

    getPendingConsultations = async (request: Request, response: Response, next: NextFunction) => {
        try {
            if (!request.user) {
                throw new Error(messages.USER_FETCH_FAILED);
            }
            const instances = await this.consultationService.find({
                filter: {
                    userId: request.user._id,
                    requestStatus: CallbackRequestStatusEnum.PENDING,
                },
                sort: { createdAt: -1 },
                populate: "consultatorId",
            });
            sendResponse({
                data: instances,
                statusCode: StatusCodes.OK,
                success: true,
                message: messages.CONSULTATION_FETCHED_SUCCESS,
                response,
            });
        } catch (err) {
            next(err);
        }
    };
}
