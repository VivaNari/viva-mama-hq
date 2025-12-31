import { USER_REQUEST_CALLBACK } from "../constants/endpoints";
import { RequestCallbackStatusEnum } from "../types/careManager.types";
import apiClientInterceptor from "./apiClientInterceptor";

export const requestCallback = async (careManagerId: string) => {
  return (
    await apiClientInterceptor().post(USER_REQUEST_CALLBACK, {
      careManagerId: careManagerId,
      requestStatus: RequestCallbackStatusEnum.PENDING,
    })
  ).data;
};
