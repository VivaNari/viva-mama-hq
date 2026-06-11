export enum RequestCallbackStatusEnum {
  PENDING = "PENDING",
  COMPLETED = "COMPLETED",
  UNHANDLED = "UNHANDLED",
}

export interface IRequestCallbackResponse {
  data: IRequestCallbackResponseData;
  message: string;
  success: boolean;
  statusCode: number;
}

export interface IRequestCallbackResponseData {
  _id: string;
  userId: string;
  consultatorId: ICareManager;
  requestStatus: RequestCallbackStatusEnum;
}

export interface ICareManager {
  _id: string;
  name: string;
  email: string;
  phoneNumber: string;
  imageUrl?: string;
}
