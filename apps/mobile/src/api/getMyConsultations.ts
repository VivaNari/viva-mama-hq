import { USER_CONSULTATION_HISTORY } from "../constants/endpoints";
import apiClientInterceptor from "./apiClientInterceptor";

/**
 * Every consultation the patient has ever booked, each tagged with the stage it
 * falls in. One call backs all three tabs.
 */
export const getMyConsultations = async () => {
  return (await apiClientInterceptor().get(USER_CONSULTATION_HISTORY)).data;
};
