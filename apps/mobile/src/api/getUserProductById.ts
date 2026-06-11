import { USER_PRODUCT_URL } from "../constants/endpoints";
import apiClientInterceptor from "./apiClientInterceptor";

export const getUserProductById = async (productId: string) => {
  return (await apiClientInterceptor().get(USER_PRODUCT_URL(productId))).data;
};
