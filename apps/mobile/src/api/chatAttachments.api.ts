import {
  CHAT_ATTACHMENT,
  CHAT_ATTACHMENTS,
  CHAT_ATTACHMENTS_CONFIG,
  CHAT_ATTACHMENTS_CONSENT,
  CHAT_ATTACHMENT_URL,
  CHAT_FLOW_REPLY,
} from '../constants/endpoints';
import type { AxiosProgressEvent, AxiosRequestConfig } from 'axios';
import { AttachmentKind, ISSEMessageData } from '../types/chat.types';
import apiClientInterceptor from './apiClientInterceptor';

type Envelope<T> = { data: T; message: string; success: boolean };

export interface IAttachmentConfig {
  enabled: boolean;
  maxBytes: number;
  maxPdfPages: number;
  maxPerTurn: number;
  acceptedMimeTypes: string[];
  dailyLimit: number;
  remainingToday: number;
  retentionDays: number;
  consentVersion: string;
  consentAccepted: boolean;
}

export interface IUploadedAttachment {
  id: string;
  kind: AttachmentKind;
  mimeType: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  pageCount: number | null;
  originalName: string | null;
  expiresAt: string;
  previewUrl: string | null;
}

export const getAttachmentConfig = async (): Promise<IAttachmentConfig> => {
  const res = await apiClientInterceptor().get<Envelope<IAttachmentConfig>>(
    CHAT_ATTACHMENTS_CONFIG,
  );
  return res.data.data;
};

export const acceptAttachmentConsent = async (consentVersion: string): Promise<void> => {
  await apiClientInterceptor().post(CHAT_ATTACHMENTS_CONSENT, { consentVersion });
};

/**
 * Upload one file. Overrides the shared client where it is wrong for a file: multipart
 * instead of JSON, a long timeout for slow networks, and no automatic retries (a
 * retried 10 MB POST on 2G helps nobody; she gets a retry button instead).
 */
export const uploadAttachment = async (
  file: { uri: string; name: string; type: string },
  clientUploadId: string,
  onProgress: (fraction: number) => void,
  signal: AbortSignal,
): Promise<IUploadedAttachment> => {
  const form = new FormData();
  form.append('clientUploadId', clientUploadId);
  form.append('file', file as unknown as Blob);
  const res = await apiClientInterceptor().post<Envelope<{ attachment: IUploadedAttachment }>>(
    CHAT_ATTACHMENTS,
    form,
    {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 120_000,
      signal,
      'axios-retry': { retries: 0 },
      onUploadProgress: (event: AxiosProgressEvent) => {
        if (event.total) onProgress(Math.min(1, event.loaded / event.total));
      },
      // Hand the FormData to the native layer as is; the JSON default would mangle it.
      transformRequest: (data: unknown) => data,
    } as AxiosRequestConfig,
  );
  return res.data.data.attachment;
};

export const getAttachmentUrl = async (id: string): Promise<{ url: string; expiresAt: string }> => {
  const res = await apiClientInterceptor().get<Envelope<{ url: string; expiresAt: string }>>(
    CHAT_ATTACHMENT_URL(id),
  );
  return res.data.data;
};

export const deleteAttachment = async (id: string): Promise<void> => {
  await apiClientInterceptor().delete(CHAT_ATTACHMENT(id));
};

/** The reply to a chatbot turn, or null while it is still being worked on (202). */
export const getChatReply = async (clientMessageId: string): Promise<ISSEMessageData | null> => {
  const res = await apiClientInterceptor().get<Envelope<{ status: string; reply?: ISSEMessageData }>>(
    CHAT_FLOW_REPLY,
    { params: { clientMessageId }, 'axios-retry': { retries: 0 } } as any,
  );
  if (res.status === 202 || res.data.data?.status !== 'ready') return null;
  return res.data.data.reply ?? null;
};
