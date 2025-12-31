export enum RequestCallbackStatusEnum {
  PENDING = "PENDING",
  COMPLETED = "COMPLETED",
  UNHANDLED = "UNHANDLED",
}

export interface IRequestCallbackResponse {
  data: {
    _id: string;
    userId: string;
    careManagerId: string;
    requestStatus: RequestCallbackStatusEnum;
  };
  message: string;
  success: boolean;
  statusCode: number;
}
