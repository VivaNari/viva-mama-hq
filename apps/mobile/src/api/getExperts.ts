import { EXPERTS } from "../constants/endpoints";
import apiClientInterceptor from "./apiClientInterceptor";

export const getExperts = async () => {
  return (await apiClientInterceptor().get(EXPERTS)).data;
};
