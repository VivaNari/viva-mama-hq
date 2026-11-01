import { IRecordGroup, RecordCategory, ScanType } from '../types/healthRecords.types';
import { errorCodeToI18nKey } from './attachments';

/** Server codes (`data.code`) for records that have their own copy. */
const RECORD_CODES = new Set([
  'HEALTH_RECORDS_DISABLED',
  'HEALTH_RECORDS_CONSENT_REQUIRED',
  'HEALTH_RECORD_NOT_FOUND',
  'HEALTH_RECORD_NOT_DRAFT',
  'HEALTH_RECORD_NOT_RETRYABLE',
  'HEALTH_RECORD_TOO_MANY_FILES',
  'HEALTH_RECORD_MIXED_KINDS',
  'HEALTH_RECORD_NO_FILES',
  'HEALTH_RECORD_INVALID_CHILD',
  'HEALTH_SUMMARY_NO_RECORDS',
  'HEALTH_SUMMARY_IN_PROGRESS',
  'HEALTH_RECORD_STORAGE_UNAVAILABLE',
]);

/** The i18n key for a records error; page checks share the chat attachment copy. */
export const recordErrorKey = (code?: string | null): string =>
  code && RECORD_CODES.has(code) ? `healthRecords.errors.${code}` : errorCodeToI18nKey(code);

/** "Lab report" or "Anomaly scan": what she called it. */
export const recordLabelKey = (category: RecordCategory, scanType: ScanType | null): string =>
  category === 'scan' && scanType
    ? `logs.records.scanTypesShort.${scanType}`
    : `logs.records.categories.${category}`;

/** Append a page of day groups, joining a day split across two pages. */
export const mergeGroups = (current: IRecordGroup[], next: IRecordGroup[]): IRecordGroup[] => {
  const out = current.map(g => ({ ...g, records: [...g.records] }));
  for (const group of next) {
    const last = out[out.length - 1];
    if (last && last.date === group.date) last.records.push(...group.records);
    else out.push({ ...group, records: [...group.records] });
  }
  return out;
};

/** Drop records by id, and any day left empty. */
export const withoutRecords = (groups: IRecordGroup[], ids: string[]): IRecordGroup[] => {
  const gone = new Set(ids);
  return groups
    .map(g => ({ ...g, records: g.records.filter(r => !gone.has(r.id)) }))
    .filter(g => g.records.length > 0);
};

/** Month sections ("November 2026") holding day groups, newest first. */
export const toMonthSections = (
  groups: IRecordGroup[],
  locale: string,
): { key: string; title: string; data: IRecordGroup[] }[] => {
  const sections: { key: string; title: string; data: IRecordGroup[] }[] = [];
  for (const group of groups) {
    const key = group.date.slice(0, 7);
    let section = sections[sections.length - 1];
    if (!section || section.key !== key) {
      section = { key, title: formatMonth(group.date, locale), data: [] };
      sections.push(section);
    }
    section.data.push(group);
  }
  return sections;
};

const asUtcDate = (isoDay: string) => new Date(`${isoDay.slice(0, 10)}T00:00:00.000Z`);

export const formatMonth = (isoDay: string, locale: string): string =>
  asUtcDate(isoDay).toLocaleDateString(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' });

export const formatDay = (isoDay: string, locale: string): string =>
  asUtcDate(isoDay).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

/** The language to ask the server for, from the app's UI locale. */
export const toRecordsLang = (language?: string | null): 'en' | 'hi' =>
  String(language ?? '').toLowerCase().startsWith('hi') ? 'hi' : 'en';
