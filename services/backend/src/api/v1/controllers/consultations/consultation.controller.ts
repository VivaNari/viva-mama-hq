import { NextFunction, Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { messages } from "../../../../constants/messages";
import caremanagerModel from "../../../../models/care-manager.model";
import UserModel from "../../../../models/user.model";
import { sendWhatsAppMessage } from "../../../../services/twilio/sendSMS";
import { ConsultationTypeEnum } from "../../../../types/consultation.types";
import sendResponse from "../../../../utils/commonFunctions/sendResponse";
import { ConsultationService } from "../../../../services/consultations/consultation.service";
import { sendPushNotification } from "../../../../utils/sendPushNotification";

export class ConsultationController {
    private consultationService: ConsultationService;

    constructor() {
        this.consultationService = new ConsultationService();
    }

    requestCallback = async (request: Request, response: Response, next: NextFunction) => {
        try {
            const { consultatorId } = request.body;
            if (!request.user) {
                throw new Error(messages.USER_FETCH_FAILED);
            }

            const userInstance = await UserModel.findById(request.user?._id);

            const consultatorInstance = await caremanagerModel.findById(consultatorId);

            if (!consultatorInstance) {
                throw new Error(messages.CARE_MANAGER_NOT_FOUND);
            }

            const payload = {
                ...request.body,
                userId: request.user._id,
                consultationType: ConsultationTypeEnum.CARE_MANAGER,
                requestStatus: "PENDING",
            };

            const instance = (await this.consultationService.create(payload)).populate(
                "consultatorId",
            );

            // Send WhatsApp message
            const message = `📞 *New Care Manager Callback Request*

            *Care Manager:* ${consultatorInstance.name}
            *User ID:* ${userInstance?.id}
            *User Email/Phone Number:* ${userInstance?.email || userInstance?.mobile_number}
            *Requested At:* ${new Date().toLocaleString()}

            Please respond as soon as possible.`;

            try {
                await sendWhatsAppMessage(consultatorInstance.phoneNumber, message);
            } catch (err) {
                console.error("WhatsApp failed (ignored)", err);
            }

            sendResponse({
                data: instance,
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
            if (!request.user) {
                throw new Error(messages.USER_FETCH_FAILED);
            }

            const userInstance = await UserModel.findById(request.user._id);

            const { id } = request.params;
            const instance = await this.consultationService.findByIdAndUpdate({
                _id: id as string,
                payload: {
                    requestStatus: "COMPLETED",
                },
            });

            if (userInstance) {
                await sendPushNotification({
                    token: userInstance.FCM_token,
                    body: "Please help us to improve our service",
                    data: {
                        type: "CONSULTATION_COMPLETED",
                        consultationId: id,
                    },
                    title: "Your consultation has been completed successfully.",
                });
            }

            sendResponse({
                data: instance,
                statusCode: StatusCodes.OK,
                success: true,
                message: messages.CONSULTATION_COMPLETED_SUCCESS,
                response,
            });
        } catch (err) {
            next(err);
        }
    };

    getActiveConsultations = async (request: Request, response: Response, next: NextFunction) => {
        try {
            if (!request.user) {
                throw new Error(messages.USER_FETCH_FAILED);
            }
            const instances = await this.consultationService.find({
                filter: {
                    userId: request.user?._id,
                    requestStatus: "PENDING",
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
