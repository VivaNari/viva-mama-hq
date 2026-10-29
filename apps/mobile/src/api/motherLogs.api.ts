import {
  API_MOTHER_LOGS,
  API_MOTHER_LOGS_ANC_SCHEDULE,
  API_MOTHER_LOGS_DAILY,
  API_MOTHER_MEDICINES,
} from '../constants/endpoints';
import { ApiEnvelope } from '../types/moodLog.types';
import {
  AppendLogType,
  DailyLogType,
  MedicineFrequency,
  MedicinePreset,
  MedicinesSnapshot,
  MotherLog,
} from '../types/motherLog.types';
import apiClientInterceptor from './apiClientInterceptor';

/**
 * Her logs, newest first. `from` / `to` are "YYYY-MM-DD"; omit `types` for every
 * readable type.
 */
export const getMotherLogs = async (params: {
  types?: (AppendLogType | DailyLogType)[];
  from?: string;
  to?: string;
  limit?: number;
}): Promise<MotherLog[]> => {
  const query: Record<string, string | number> = {};
  if (params.types?.length) query.types = params.types.join(',');
  if (params.from) query.from = params.from;
  if (params.to) query.to = params.to;
  if (params.limit) query.limit = params.limit;

  const res = await apiClientInterceptor().get<ApiEnvelope<MotherLog[]>>(API_MOTHER_LOGS, {
    params: query,
  });
  return res.data.data ?? [];
};

/** Append one entry for today. */
export const addMotherLog = async (
  logType: AppendLogType,
  fields: Record<string, any>,
): Promise<MotherLog> => {
  const res = await apiClientInterceptor().post<ApiEnvelope<MotherLog>>(API_MOTHER_LOGS, {
    logType,
    fields,
  });
  return res.data.data;
};

/** Remove one of today's entries. */
export const deleteMotherLog = async (id: string): Promise<void> => {
  await apiClientInterceptor().delete(`${API_MOTHER_LOGS}/${id}`);
};

/** Set today's running total for a tap counter (water glasses, baby kicks). */
export const setDailyMotherLog = async (
  logType: DailyLogType,
  fields: Record<string, number>,
): Promise<MotherLog> => {
  const res = await apiClientInterceptor().put<ApiEnvelope<MotherLog>>(API_MOTHER_LOGS_DAILY, {
    logType,
    fields,
  });
  return res.data.data;
};

export const getAncSchedule = async (): Promise<string[]> => {
  const res = await apiClientInterceptor().get<ApiEnvelope<{ doneItemIds: string[] }>>(
    API_MOTHER_LOGS_ANC_SCHEDULE,
  );
  return res.data.data?.doneItemIds ?? [];
};

export const setAncScheduleItem = async (itemId: string, done: boolean): Promise<string[]> => {
  const res = await apiClientInterceptor().put<ApiEnvelope<{ doneItemIds: string[] }>>(
    `${API_MOTHER_LOGS_ANC_SCHEDULE}/${itemId}`,
    { done },
  );
  return res.data.data?.doneItemIds ?? [];
};

export const getMedicines = async (): Promise<MedicinesSnapshot> => {
  const res = await apiClientInterceptor().get<ApiEnvelope<MedicinesSnapshot>>(API_MOTHER_MEDICINES);
  return res.data.data;
};

/** Add a preset or a medicine she named herself. */
export const addMedicine = async (
  medicine: { presetKey: MedicinePreset } | { name: string },
  frequency: MedicineFrequency,
): Promise<MedicinesSnapshot> => {
  const res = await apiClientInterceptor().post<ApiEnvelope<MedicinesSnapshot>>(
    API_MOTHER_MEDICINES,
    { ...medicine, frequency },
  );
  return res.data.data;
};

export const setMedicineTaken = async (id: string, taken: boolean): Promise<MedicinesSnapshot> => {
  const res = await apiClientInterceptor().put<ApiEnvelope<MedicinesSnapshot>>(
    `${API_MOTHER_MEDICINES}/${id}/taken`,
    { taken },
  );
  return res.data.data;
};
