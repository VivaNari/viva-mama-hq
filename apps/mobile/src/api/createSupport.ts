import { API_CREATE_SUPPORT } from "../constants/endpoints";
import apiClientInterceptor from "./apiClientInterceptor";

export const createSupport = async (supportType: string, message: string) => {
  return (
    await apiClientInterceptor().post(API_CREATE_SUPPORT, {
      supportType,
      message,
    })
  ).data;
};
