import { USER_EXPERT_URL } from "../constants/endpoints";
import apiClientInterceptor from "./apiClientInterceptor";

export const getExpertById = async (expertId: string) => {
  return (await apiClientInterceptor().get(USER_EXPERT_URL(expertId))).data;
};
