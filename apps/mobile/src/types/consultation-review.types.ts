export interface SubmitConsultationReviewResponse {
  data: SubmitConsultationReview;
  message: string;
  statusCode: number;
  success: boolean;
}

export interface SubmitConsultationReview {
  consultationId: string;
  rating: number;
  review: string;
}
