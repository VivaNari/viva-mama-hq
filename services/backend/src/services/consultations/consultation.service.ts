import { Schema } from "mongoose";
import { messages, notificationMessages } from "../../constants/messages";
import consultationModel from "../../models/consultation.model";
import { ICareManager } from "../../types/care-manager.types";
import {
    CallbackRequestStatusEnum,
    ConsultationTypeEnum,
    IConsultationRequest,
    IValidateCompleteConsultationParams,
    IValidateCompleteConsultationParamsError,
    IValidateRequestCallBackParams,
    IValidateRequestCallBackParamsError,
} from "../../types/consultation.types";
import { sendPushNotification } from "../../utils/sendPushNotification";
import BaseService from "../base.service";
import { CareManagerService } from "../care-manager/care-manager.service";
import { sendWhatsappMessageForCareManager } from "../getgabs/sendWhatsappMessageForCareManager";
import UserService from "../users/user.service";

export class ConsultationService extends BaseService<IConsultationRequest> {
    private userService: UserService;
    private careManagerService: CareManagerService;

    constructor() {
        super(consultationModel);
        this.userService = new UserService();
        this.careManagerService = new CareManagerService();
    }

    validateRequestCallBackParams = async (
        userId: string,
        consultatorId: string,
    ): Promise<IValidateRequestCallBackParams | IValidateRequestCallBackParamsError> => {
        const userInstance = await this.userService.findById({
            _id: userId,
        });

        if (!userInstance) {
            return {
                isValid: false,
                errorMessage: messages.USER_NOT_FOUND,
            };
        }

        const consultatorInstance = await this.careManagerService.findById({
            _id: consultatorId,
        });

        if (!consultatorInstance) {
            return {
                isValid: false,
                errorMessage: messages.CARE_MANAGER_NOT_FOUND,
            };
        }

        return {
            isValid: true,
            userInstance,
            consultatorInstance,
        };
    };

    requestCallback = async (userId: string, consultatorId: string) => {
        const result = await this.validateRequestCallBackParams(userId, consultatorId);

        if (!result.isValid) {
            return {
                isValid: false,
                errorMessage: result.errorMessage,
            };
        }

        const { userInstance, consultatorInstance } = result;

        const consultationPayload: IConsultationRequest = {
            userId: userId as unknown as Schema.Types.ObjectId,
            consultatorId: consultatorId as unknown as Schema.Types.ObjectId,
            consultationType: ConsultationTypeEnum.CARE_MANAGER,
            requestStatus: CallbackRequestStatusEnum.PENDING,
        };

        const consultationInstance: IConsultationRequest = await this.create(consultationPayload);

        try {
            await sendWhatsappMessageForCareManager({
                to: (consultatorInstance as ICareManager).phoneNumber,
                careManagerName: (consultatorInstance as ICareManager).name,
                userId: userInstance._id.toString(),
                userEmailOrPhone: userInstance.email || userInstance.mobile_number || "",
                requestedAt: new Date().toLocaleString(),
            });
        } catch (err) {
            console.error("WhatsApp failed (ignored)", err);
            throw err;
        }

        return consultationInstance;
    };

    validateCompleteConsultationParams = async (
        userId: string,
        consultationId: string,
    ): Promise<IValidateCompleteConsultationParamsError | IValidateCompleteConsultationParams> => {
        const userInstance = await this.userService.findById({
            _id: userId,
        });

        if (!userInstance) {
            return {
                isValid: false,
                errorMessage: messages.USER_NOT_FOUND,
            };
        }

        const consultationInstance = await this.findById({
            _id: consultationId,
        });

        if (!consultationInstance) {
            return {
                isValid: false,
                errorMessage: messages.CONSULTATION_NOT_FOUND,
            };
        }

        return {
            isValid: true,
            userInstance,
        };
    };

    completeConsultation = async (userId: string, consultationId: string) => {
        const validationResult = await this.validateCompleteConsultationParams(
            userId,
            consultationId,
        );

        if (!validationResult.isValid) {
            throw new Error(validationResult.errorMessage);
        }

        const { userInstance } = validationResult;

        const updatedConsultationInstance = await this.findByIdAndUpdate({
            _id: consultationId,
            payload: {
                requestStatus: CallbackRequestStatusEnum.COMPLETED,
            },
        });

        if (userInstance) {
            await sendPushNotification({
                token: userInstance.FCM_token,
                body: notificationMessages.NOTIFICATION_COMPLETE_NOTIFICATION_BODY,
                data: {
                    type: "CONSULTATION_COMPLETED",
                    consultationId: consultationId,
                },
                title: notificationMessages.NOTIFICATION_COMPLETE_NOTIFICATION_TITLE,
            });
        }

        return updatedConsultationInstance;
    };
}
