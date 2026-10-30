import { API_CHAT_LOG_CONFIRM } from '../constants/endpoints';
import { IPendingLog } from '../types/chat.types';
import { ApiEnvelope } from '../types/moodLog.types';
import apiClientInterceptor from './apiClientInterceptor';

/**
 * Her Yes (`accept: true`) or No on one item of a "Save this log?" card. Returns the
 * item as it now stands; answering an item twice is harmless.
 */
export const confirmChatLog = async (
  messageId: string,
  proposalId: string,
  accept: boolean,
): Promise<IPendingLog> => {
  const res = await apiClientInterceptor().post<ApiEnvelope<IPendingLog>>(API_CHAT_LOG_CONFIRM, {
    messageId,
    proposalId,
    accept,
  });
  return res.data.data;
};
