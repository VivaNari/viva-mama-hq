import type { AxiosProgressEvent, AxiosRequestConfig } from 'axios';

import {
  HEALTH_RECORD,
  HEALTH_RECORDS,
  HEALTH_RECORDS_BULK_DELETE,
  HEALTH_RECORDS_CONFIG,
  HEALTH_RECORDS_CONSENT,
  HEALTH_RECORD_FILE,
  HEALTH_RECORD_FILES,
  HEALTH_RECORD_FILE_URL,
  HEALTH_RECORD_RETRY,
  HEALTH_RECORD_SUBMIT,
  HEALTH_SUMMARY,
  HEALTH_SUMMARY_BY_ID,
  HEALTH_SUMMARY_HISTORY,
  HEALTH_SUMMARY_LATEST,
} from '../constants/endpoints';
import {
  IHealthRecord,
  IHealthRecordFile,
  IHealthRecordsConfig,
  IHealthSummary,
  ILatestHealthSummary,
  IQuota,
  IRecordGroup,
  RecordCategory,
  RecordSubjectType,
  ScanType,
} from '../types/healthRecords.types';
import apiClientInterceptor from './apiClientInterceptor';

type Envelope<T> = { data: T; message: string; success: boolean };

const client = () => apiClientInterceptor();

export const getHealthRecordsConfig = async (): Promise<IHealthRecordsConfig> =>
  (await client().get<Envelope<IHealthRecordsConfig>>(HEALTH_RECORDS_CONFIG)).data.data;

export const acceptHealthRecordsConsent = async (consentVersion: string): Promise<void> => {
  await client().post(HEALTH_RECORDS_CONSENT, { consentVersion });
};

/** Start a record. Idempotent on clientUploadId, so a retried create returns the same draft. */
export const createHealthRecord = async (body: {
  clientUploadId: string;
  category: RecordCategory;
  scanType?: ScanType | null;
  subject: { type: RecordSubjectType; childId?: string | null };
}): Promise<IHealthRecord> =>
  (await client().post<Envelope<{ record: IHealthRecord }>>(HEALTH_RECORDS, body)).data.data.record;

/**
 * Upload one page. Same overrides as a chat attachment: multipart, a long timeout for
 * slow networks, and no automatic retries (she gets a retry button instead).
 */
export const uploadHealthRecordFile = async (
  recordId: string,
  file: { uri: string; name: string; type: string },
  clientUploadId: string,
  onProgress: (fraction: number) => void,
  signal: AbortSignal,
): Promise<{ file: IHealthRecordFile; previewUrl: string | null }> => {
  const form = new FormData();
  form.append('clientUploadId', clientUploadId);
  form.append('file', file as unknown as Blob);
  const res = await client().post<Envelope<{ file: IHealthRecordFile; previewUrl: string | null }>>(
    HEALTH_RECORD_FILES(recordId),
    form,
    {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 120_000,
      signal,
      'axios-retry': { retries: 0 },
      onUploadProgress: (event: AxiosProgressEvent) => {
        if (event.total) onProgress(Math.min(1, event.loaded / event.total));
      },
      transformRequest: (data: unknown) => data,
    } as AxiosRequestConfig,
  );
  return res.data.data;
};

export const removeHealthRecordFile = async (recordId: string, fileId: string): Promise<void> => {
  await client().delete(HEALTH_RECORD_FILE(recordId, fileId));
};

export const submitHealthRecord = async (
  recordId: string,
  lang: string,
): Promise<{ record: IHealthRecord; quota: IQuota }> =>
  (
    await client().post<Envelope<{ record: IHealthRecord; quota: IQuota }>>(
      HEALTH_RECORD_SUBMIT(recordId),
      { lang },
      { 'axios-retry': { retries: 0 } } as AxiosRequestConfig,
    )
  ).data.data;

export const retryHealthRecord = async (recordId: string): Promise<{ record: IHealthRecord; quota: IQuota }> =>
  (
    await client().post<Envelope<{ record: IHealthRecord; quota: IQuota }>>(
      HEALTH_RECORD_RETRY(recordId),
      {},
      { 'axios-retry': { retries: 0 } } as AxiosRequestConfig,
    )
  ).data.data;

export const getHealthRecord = async (recordId: string): Promise<IHealthRecord> =>
  (await client().get<Envelope<{ record: IHealthRecord }>>(HEALTH_RECORD(recordId))).data.data.record;

export const listHealthRecords = async (params: {
  cursor?: string | null;
  limit?: number;
  subject?: RecordSubjectType;
  childId?: string;
  category?: RecordCategory;
}): Promise<{ groups: IRecordGroup[]; nextCursor: string | null; readyRecords: number }> => {
  const query = Object.fromEntries(Object.entries(params).filter(([, v]) => v != null && v !== ''));
  return (
    await client().get<Envelope<{ groups: IRecordGroup[]; nextCursor: string | null; readyRecords: number }>>(
      HEALTH_RECORDS,
      { params: query },
    )
  ).data.data;
};

export const updateHealthRecord = async (
  recordId: string,
  changes: {
    category?: RecordCategory;
    scanType?: ScanType | null;
    subject?: { type: RecordSubjectType; childId?: string | null };
  },
): Promise<IHealthRecord> =>
  (await client().patch<Envelope<{ record: IHealthRecord }>>(HEALTH_RECORD(recordId), changes)).data.data
    .record;

export const deleteHealthRecord = async (recordId: string): Promise<void> => {
  await client().delete(HEALTH_RECORD(recordId));
};

export const deleteHealthRecords = async (ids: string[]): Promise<number> =>
  (await client().post<Envelope<{ deleted: number }>>(HEALTH_RECORDS_BULK_DELETE, { ids })).data.data
    .deleted;

export const getHealthRecordFileUrl = async (
  recordId: string,
  fileId: string,
): Promise<{ url: string; expiresAt: string }> =>
  (await client().get<Envelope<{ url: string; expiresAt: string }>>(HEALTH_RECORD_FILE_URL(recordId, fileId)))
    .data.data;

// ── Overall summary ─────────────────────────────────────────────────────────────

export const generateHealthSummary = async (
  lang: string,
): Promise<{ summary: IHealthSummary; quota: IQuota }> =>
  (
    await client().post<Envelope<{ summary: IHealthSummary; quota: IQuota }>>(
      HEALTH_SUMMARY,
      { lang },
      { 'axios-retry': { retries: 0 } } as AxiosRequestConfig,
    )
  ).data.data;

export const getLatestHealthSummary = async (): Promise<ILatestHealthSummary> =>
  (await client().get<Envelope<ILatestHealthSummary>>(HEALTH_SUMMARY_LATEST)).data.data;

export const getHealthSummary = async (id: string): Promise<IHealthSummary> =>
  (await client().get<Envelope<{ summary: IHealthSummary }>>(HEALTH_SUMMARY_BY_ID(id))).data.data.summary;

export const getHealthSummaryHistory = async (
  before?: string | null,
): Promise<{ summaries: IHealthSummary[]; nextBefore: string | null }> =>
  (
    await client().get<Envelope<{ summaries: IHealthSummary[]; nextBefore: string | null }>>(
      HEALTH_SUMMARY_HISTORY,
      { params: before ? { before } : {} },
    )
  ).data.data;

export const deleteHealthSummary = async (id: string): Promise<void> => {
  await client().delete(HEALTH_SUMMARY_BY_ID(id));
};
