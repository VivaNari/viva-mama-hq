import Joi from "joi";
import { IConsultationReview } from "../../../../types/consultation-review.types";

const addConsultationReviewValidator = Joi.object<IConsultationReview>({
    consultationId: Joi.string().required(),
    rating: Joi.number().required(),
    review: Joi.string().optional().allow(null).allow(""),
});

export default addConsultationReviewValidator;
