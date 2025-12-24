import { CHEKIN_HISTORY } from '../constants/endpoints';
import apiClientInterceptor from './apiClientInterceptor';

export const checkinHistory = async () => {
  return (await apiClientInterceptor().get(CHEKIN_HISTORY)).data;
};
