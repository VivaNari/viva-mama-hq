import { AttachmentKind } from './chat.types';

export type RecordCategory = 'scan' | 'lab' | 'prescription' | 'mch';
export type ScanType = 'dating' | 'anomaly' | 'growth';
export type RecordSubjectType = 'MOTHER' | 'CHILD';
export type RecordStatus = 'DRAFT' | 'PROCESSING' | 'READY' | 'REJECTED' | 'FAILED';
export type RecordSeverity = 'NONE' | 'MEDIUM' | 'HIGH';

export interface IQuota {
  used: number;
  limit: number | null;
  remaining: number | null;
}

export interface IHealthRecordsConfig {
  enabled: boolean;
  maxFiles: number;
  maxBytes: number;
  maxPdfPages: number;
  acceptedMimeTypes: string[];
  consentVersion: string;
  consentAccepted: boolean;
  quota: { uploads: IQuota; summaries: IQuota };
}

export interface IRecordSubject {
  type: RecordSubjectType;
  childId: string | null;
  childName?: string | null;
}

/** One record in the list: enough for the thumbnail card. */
export interface IHealthRecordItem {
  id: string;
  category: RecordCategory;
  scanType: ScanType | null;
  subject: IRecordSubject;
  title: string | null;
  status: RecordStatus;
  severity: RecordSeverity | null;
  /** 'YYYY-MM-DD': the day she added it. */
  recordDate: string;
  kind: AttachmentKind | null;
  fileCount: number;
  pageCount: number | null;
  /** Short-lived signed link to the first photo; null for a PDF. */
  thumbnailUrl: string | null;
  reasonCode: string | null;
  /** Why a refused or failed record was not saved, in her language. */
  message: string | null;
  createdAt: string;
}

export interface IHealthRecordFile {
  id: string;
  kind: AttachmentKind;
  mimeType: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  pageCount: number | null;
  originalName: string | null;
}

export interface IHealthRecord extends IHealthRecordItem {
  files: IHealthRecordFile[];
  summary: {
    markdown: string;
    severity: RecordSeverity;
    criticalMatches: string[];
    lang: string;
    generatedAt: string;
  } | null;
}

export interface IRecordGroup {
  date: string;
  records: IHealthRecordItem[];
}

export interface IHealthSummaryContent {
  lang: 'en' | 'hi';
  generated_on: string;
  facts: {
    name: string;
    stage: string | null;
    week: number | null;
    stage_line: string;
    conditions: string[];
    medicines: string[];
    children: { name: string; sex: string; age_text: string }[];
  };
  overview: string;
  mother_points: string[];
  baby_points: { child_name: string; points: string[] }[];
  trends: string[];
  questions_for_doctor: string[];
  values_to_discuss: {
    record_id: string;
    record_date: string;
    record_title: string;
    subject: string;
    name: string;
    value: string;
    reference_range: string | null;
    status: string;
    urgent: boolean;
  }[];
  vitals: string[];
  records: { record_id: string; date: string; title: string; subject: string; severity: RecordSeverity }[];
  disclaimer: string;
}

export interface IHealthSummary {
  id: string;
  status: 'PENDING' | 'READY' | 'FAILED';
  lang: string;
  content: IHealthSummaryContent | null;
  shareText?: string | null;
  errorCode: string | null;
  recordCount: number;
  createdAt: string;
}

export interface ILatestHealthSummary {
  summary: IHealthSummary | null;
  stale: { newRecords: number; removedRecords: number } | null;
  pending: IHealthSummary | null;
  readyRecords: number;
  quota: IQuota;
}
