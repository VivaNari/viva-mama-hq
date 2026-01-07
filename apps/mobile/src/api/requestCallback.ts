import { USER_REQUEST_CALLBACK } from "../constants/endpoints";
import apiClientInterceptor from "./apiClientInterceptor";

export const requestCallback = async (careManagerId: string) => {
  return (
    await apiClientInterceptor().post(USER_REQUEST_CALLBACK, {
      consultatorId: careManagerId,
    })
  ).data;
};
