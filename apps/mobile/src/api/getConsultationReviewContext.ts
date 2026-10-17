import { CONSULTATION_REVIEW_CONTEXT } from "../constants/endpoints";
import apiClientInterceptor from "./apiClientInterceptor";

/**
 * Who the consultation was with, so the rating screen can say whose session is
 * being rated instead of asking for an anonymous score.
 */
export const getConsultationReviewContext = async (consultationId: string) => {
  return (
    await apiClientInterceptor().get(CONSULTATION_REVIEW_CONTEXT(consultationId))
  ).data;
};
