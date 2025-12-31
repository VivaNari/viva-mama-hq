import { USER_DATA } from '../constants/endpoints';
import apiClientInterceptor from './apiClientInterceptor';

export const getUserData = async () => {
  return (await apiClientInterceptor().get(USER_DATA)).data;
};
