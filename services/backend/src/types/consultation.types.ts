import { Document, Types } from "mongoose";

export type CallbackRequestStatus = "PENDING" | "COMPLETED" | "UNHANDLED";

export interface IConsultationRequest extends Document {
    userId: Types.ObjectId;
    consultatorId: Types.ObjectId;
    consultationType: ConsultationTypeEnum;
    requestStatus: CallbackRequestStatus;
}

export enum ConsultationTypeEnum {
    CARE_MANAGER = "CARE_MANAGER",
    EXPERT = "EXPERT",
}
