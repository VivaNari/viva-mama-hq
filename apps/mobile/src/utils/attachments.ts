import { AttachmentKind, IPendingAttachment } from '../types/chat.types';

/**
 * A random v4 UUID. Used as an idempotency key (clientUploadId, clientMessageId),
 * not as a secret, so Math.random is enough; Hermes has no crypto.randomUUID.
 */
export const newUuid = (): string =>
  'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });

export const formatBytes = (bytes?: number | null): string => {
  if (!bytes || bytes <= 0) return '';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export const kindForMime = (mimeType: string): AttachmentKind | null => {
  if (mimeType === 'application/pdf') return 'PDF';
  if (/^image\/(jpeg|jpg|png|webp|heic|heif)$/i.test(mimeType)) return 'IMAGE';
  return null;
};

/** Error codes the server sends (`data.code`) that have their own copy. */
const KNOWN_CODES = new Set([
  'FEATURE_DISABLED',
  'ATTACHMENT_CONSENT_REQUIRED',
  'ATTACHMENT_MISSING',
  'ATTACHMENT_TOO_LARGE',
  'ATTACHMENT_UNSUPPORTED_TYPE',
  'ATTACHMENT_CORRUPT',
  'ATTACHMENT_PDF_ENCRYPTED',
  'ATTACHMENT_PDF_TOO_MANY_PAGES',
  'ATTACHMENT_PDF_UNSAFE',
  'ATTACHMENT_IMAGE_TOO_SMALL',
  'ATTACHMENT_IMAGE_TOO_LARGE_DIMENSIONS',
  'ATTACHMENT_DAILY_LIMIT',
  'ATTACHMENT_RATE_LIMIT',
  'ATTACHMENT_BUSY',
  'ATTACHMENT_STORAGE_UNAVAILABLE',
  'ATTACHMENT_EXPIRED',
  'ATTACHMENT_NOT_AVAILABLE',
  'ATTACHMENT_TOO_MANY',
  'ATTACHMENT_MIXED_KINDS',
  'ATTACHMENT_PROCESSING_FAILED',
  'AI_UNAVAILABLE',
]);

/** The i18n key for a server error code, falling back to a generic message. */
export const errorCodeToI18nKey = (code?: string | null): string =>
  code && KNOWN_CODES.has(code) ? `chat.attachments.errors.${code}` : 'chat.attachments.errors.GENERIC';

/** The `data.code` of an axios error from our API, if any. */
export const serverErrorCode = (error: any): string | undefined => {
  const data = error?.response?.data;
  const code = data?.data?.code ?? data?.code;
  if (typeof code === 'string') return code;
  if (error?.code === 'ECONNABORTED') return 'NETWORK_TIMEOUT';
  if (!error?.response) return 'NETWORK';
  return undefined;
};

/** Ready to send: uploaded, and nothing still uploading or failed. */
export const readyAttachments = (items: IPendingAttachment[]): IPendingAttachment[] =>
  items.filter(a => a.state === 'uploaded' && a.serverId);

/** Whether more files of `kind` can be added to what is already picked. */
export const canAdd = (
  items: IPendingAttachment[],
  kind: AttachmentKind,
  count: number,
  maxPerTurn: number,
): 'ok' | 'mixed' | 'too_many' => {
  const hasPdf = items.some(a => a.kind === 'PDF');
  if (items.length > 0 && (kind === 'PDF' || hasPdf)) return 'mixed';
  if (kind === 'PDF' && count > 1) return 'too_many';
  if (items.length + count > maxPerTurn) return 'too_many';
  return 'ok';
};
