import { USER_REQUEST_CALLBACK } from "../constants/endpoints";
import apiClientInterceptor from "./apiClientInterceptor";

export const requestCallback = async (
  careManagerId: string,
  preferred_consultation_date: string,
) => {
  return (
    await apiClientInterceptor().post(USER_REQUEST_CALLBACK, {
      consultatorId: careManagerId,
      preferred_consultation_date,
    })
  ).data;
};
