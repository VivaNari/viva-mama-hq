import { USER_PRODUCTS } from '../constants/endpoints';
import apiClientInterceptor from './apiClientInterceptor';

export const getUserProducts = async () => {
  return (await apiClientInterceptor().get(USER_PRODUCTS)).data;
};
