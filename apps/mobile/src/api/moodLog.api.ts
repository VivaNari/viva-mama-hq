import { API_MOOD_LOGS } from '../constants/endpoints';
import { ApiEnvelope, EMood, MoodLog } from '../types/moodLog.types';
import apiClientInterceptor from './apiClientInterceptor';

/**
 * Fetch the user's mood logs, optionally bounded by a calendar range.
 * `from` / `to` are "YYYY-MM-DD" strings.
 */
export const getMoodLogs = async (
  from?: string,
  to?: string,
): Promise<MoodLog[]> => {
  const params: Record<string, string> = {};
  if (from) params.from = from;
  if (to) params.to = to;

  const res = await apiClientInterceptor().get<ApiEnvelope<MoodLog[]>>(
    API_MOOD_LOGS,
    { params },
  );
  return res.data.data ?? [];
};

/** Create or update the mood for a given calendar day. */
export const upsertMoodLog = async (
  mood: EMood,
  logDate: string,
): Promise<MoodLog> => {
  const res = await apiClientInterceptor().post<ApiEnvelope<MoodLog>>(
    API_MOOD_LOGS,
    { mood, logDate },
  );
  return res.data.data;
};

/** Delete the mood log for a given calendar day. */
export const deleteMoodLog = async (logDate: string): Promise<void> => {
  await apiClientInterceptor().delete(API_MOOD_LOGS, { data: { logDate } });
};
