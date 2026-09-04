import { RequestCallbackStatusEnum } from "./careManager.types";
import { ConsultationTypeEnum } from "./consultation.types";

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

/**
 * The display-only slice of a consultant the rating screen needs. Care managers
 * and experts live in different collections with different field names; the
 * server flattens both to this shape, so `speciality` and `photograph` are null
 * whenever the source document has no equivalent.
 */
export interface ConsultationReviewConsultator {
  _id: string;
  name: string;
  speciality: string | null;
  qualification: string | null;
  photograph: string | null;
}

export interface ConsultationReviewContext {
  consultationId: string;
  consultationType: ConsultationTypeEnum;
  requestStatus: RequestCallbackStatusEnum;
  /** When the call happened, falling back to the booked date if never confirmed. */
  consultedAt: string;
  consultator: ConsultationReviewConsultator | null;
  /** True once a rating exists, so the screen can show it instead of a form. */
  alreadyReviewed: boolean;
  existingRating: number | null;
}

export interface ConsultationReviewContextResponse {
  data: ConsultationReviewContext;
  message: string;
  statusCode: number;
  success: boolean;
}
