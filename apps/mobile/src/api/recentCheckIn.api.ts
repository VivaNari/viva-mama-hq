import {
  DISMISS_EMERGENCY_ALERT,
  RECENT_CHECKIN_DATA,
} from '../constants/endpoints';
import apiClientInterceptor from './apiClientInterceptor';

export const getRecentCheckinData = async () => {
  return (await apiClientInterceptor().get(RECENT_CHECKIN_DATA)).data;
};

export const dismissEmergencyAlert = async (recommendationHistoryId: string) => {
  return (await apiClientInterceptor().patch(DISMISS_EMERGENCY_ALERT(recommendationHistoryId)))
    .data;
};
