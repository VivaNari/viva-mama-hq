import { API_AI_MESSAGE_REPORT } from "../constants/endpoints";
import { ReportReason } from "../types/vivaClub.types";
import apiClientInterceptor from "./apiClientInterceptor";

/**
 * Flag a Viva AI reply.
 *
 * Reporting the same reply twice succeeds rather than erroring — the server treats a
 * repeat as already handled, so the caller never has to special-case it.
 *
 * The server also captures the message that prompted the reply, so a reviewer can judge
 * the answer. The sheet says so before this is called; do not call it from anywhere that
 * has not shown that disclosure.
 */
export const reportAIMessage = async (input: {
  messageId: string;
  reason: ReportReason;
  details?: string;
}) =>
  (
    await apiClientInterceptor().post(API_AI_MESSAGE_REPORT, {
      messageId: input.messageId,
      reason: input.reason,
      // Omitted rather than sent empty: the validator rejects unknown keys, and a blank
      // string in the queue reads as "the reporter wrote something" when they did not.
      ...(input.details?.trim() ? { details: input.details.trim() } : {}),
    })
  ).data;
