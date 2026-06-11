import consultationReviewModel from "../../models/consultation-review.model";
import { IConsultationReview } from "../../types/consultation-review.types";
import BaseService from "../base.service";

export class ConsultationReviewService extends BaseService<IConsultationReview> {
    constructor() {
        super(consultationReviewModel);
    }
}
