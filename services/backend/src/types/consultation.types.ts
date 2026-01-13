import { Schema } from "mongoose";
import { ICareManager } from "./care-manager.types";
import { IUser } from "./user.types";

export type CallbackRequestStatus = "PENDING" | "COMPLETED" | "UNHANDLED";

export enum CallbackRequestStatusEnum {
    PENDING = "PENDING",
    COMPLETED = "COMPLETED",
    UNHANDLED = "UNHANDLED",
}

export interface IConsultationRequest {
    userId: Schema.Types.ObjectId;
    consultatorId: Schema.Types.ObjectId;
    consultationType: ConsultationTypeEnum;
    requestStatus: CallbackRequestStatus;
}

export enum ConsultationTypeEnum {
    CARE_MANAGER = "CARE_MANAGER",
    EXPERT = "EXPERT",
}

export type IValidateRequestCallBackParamsError = {
    isValid: false;
    errorMessage: string;
};
export type IValidateRequestCallBackParams = {
    isValid: true;
    userInstance: IUser;
    consultatorInstance: ICareManager;
};

export type IValidateCompleteConsultationParamsError = {
    isValid: false;
    errorMessage: string;
};
export type IValidateCompleteConsultationParams = {
    isValid: true;
    userInstance: IUser;
};
