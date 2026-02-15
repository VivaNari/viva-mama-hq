import { ICareManager, RequestCallbackStatusEnum } from "./careManager.types";
import { IExpert } from "./expert.types";

export interface IUserActiveConsultations {
  _id: string;
  userId: string;
  consultatorId: IExpert | ICareManager;
  consultationType: ConsultationTypeEnum;
  requestStatus: RequestCallbackStatusEnum;
  createdAt: string;
  preferred_consultation_date: string;
}

export enum ConsultationTypeEnum {
  CARE_MANAGER = "CARE_MANAGER",
  EXPERT = "EXPERT",
}

export interface IUserActiveConsultationsResponse {
  data: IUserActiveConsultations[];
  message: string;
  statusCode: number;
  success: boolean;
}
