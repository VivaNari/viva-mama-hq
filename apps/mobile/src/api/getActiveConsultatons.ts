import { USER_ACTIVE_CONSULTATIONS } from "../constants/endpoints";
import apiClientInterceptor from "./apiClientInterceptor";

export const getActiveConsultations = async () => {
  return (await apiClientInterceptor().get(USER_ACTIVE_CONSULTATIONS)).data;
};
