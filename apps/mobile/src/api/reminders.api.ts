import { API_MOTHER_REMINDERS } from '../constants/endpoints';
import { ApiEnvelope } from '../types/moodLog.types';
import { MotherReminder, NewReminder } from '../types/reminder.types';
import apiClientInterceptor from './apiClientInterceptor';

/** Her reminders that have not ended, oldest first. */
export const getReminders = async (): Promise<MotherReminder[]> => {
  const res = await apiClientInterceptor().get<ApiEnvelope<{ reminders: MotherReminder[] }>>(
    API_MOTHER_REMINDERS,
  );
  return res.data.data?.reminders ?? [];
};

/** Starts today; the server sends it as a push notification at the chosen slot. */
export const createReminder = async (reminder: NewReminder): Promise<MotherReminder> => {
  const res = await apiClientInterceptor().post<ApiEnvelope<MotherReminder>>(
    API_MOTHER_REMINDERS,
    reminder,
  );
  return res.data.data;
};

export const deleteReminder = async (id: string): Promise<void> => {
  await apiClientInterceptor().delete(`${API_MOTHER_REMINDERS}/${id}`);
};
