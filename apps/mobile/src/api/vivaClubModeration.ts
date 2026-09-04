import {
  API_VIVA_CLUB_BLOCK_USER,
  API_VIVA_CLUB_DELETE_COMMENT,
  API_VIVA_CLUB_DELETE_POST,
  API_VIVA_CLUB_GUIDELINES_ACCEPT,
  API_VIVA_CLUB_GUIDELINES_STATUS,
  API_VIVA_CLUB_REPORT,
} from "../constants/endpoints";
import apiClientInterceptor from "./apiClientInterceptor";
import { ReportReason, ReportTargetType } from "../types/vivaClub.types";

/**
 * Report a post or comment.
 *
 * Reporting the same item twice succeeds rather than erroring — the server treats a
 * repeat as already-handled, so the caller never has to special-case it.
 */
export const reportContent = async (input: {
  targetType: ReportTargetType;
  targetId: string;
  reason: ReportReason;
  details?: string;
}) =>
  (
    await apiClientInterceptor().post(API_VIVA_CLUB_REPORT, {
      targetType: input.targetType,
      targetId: input.targetId,
      reason: input.reason,
      // Omitted rather than sent empty: the validator rejects unknown keys, and a blank
      // string in the queue reads as "the reporter wrote something" when they did not.
      ...(input.details?.trim() ? { details: input.details.trim() } : {}),
    })
  ).data;

export const deleteOwnPost = async (postId: string) =>
  (await apiClientInterceptor().delete(API_VIVA_CLUB_DELETE_POST(postId))).data;

export const deleteOwnComment = async (postId: string, commentId: string) =>
  (await apiClientInterceptor().delete(API_VIVA_CLUB_DELETE_COMMENT(postId, commentId)))
    .data;

/** Hides that user's content from you, and yours from them. */
export const blockUser = async (userId: string) =>
  (await apiClientInterceptor().post(API_VIVA_CLUB_BLOCK_USER(userId))).data;

export const unblockUser = async (userId: string) =>
  (await apiClientInterceptor().delete(API_VIVA_CLUB_BLOCK_USER(userId))).data;

export interface IGuidelinesStatus {
  accepted: boolean;
  version: string;
  banned: boolean;
}

export const getGuidelinesStatus = async (): Promise<IGuidelinesStatus> =>
  (await apiClientInterceptor().get(API_VIVA_CLUB_GUIDELINES_STATUS)).data.data;

export const acceptGuidelines = async () =>
  (await apiClientInterceptor().post(API_VIVA_CLUB_GUIDELINES_ACCEPT)).data;
