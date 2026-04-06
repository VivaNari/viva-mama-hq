import { SUBMIT_CONSULTATION_REVIEW } from "../constants/endpoints";
import apiClientInterceptor from "./apiClientInterceptor";

export const submitConsultationReview = async (
  consultationId: string,
  rating: number,
  review: string,
) => {
  return (
    await apiClientInterceptor().post(SUBMIT_CONSULTATION_REVIEW, {
      consultationId,
      rating,
      review,
    })
  ).data;
};
