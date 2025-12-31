import { RECENT_CHECKIN_DATA } from '../constants/endpoints';
import apiClientInterceptor from './apiClientInterceptor';

export const getRecentCheckinData = async () => {
  return (await apiClientInterceptor().get(RECENT_CHECKIN_DATA)).data;
};
