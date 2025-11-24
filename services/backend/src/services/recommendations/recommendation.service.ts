import recommendationModel from "../../models/recommendation.model";
import BaseService from "../base.service";
import { IRecommendation } from "../../types/recommendation.types";

class RecommendationService extends BaseService<IRecommendation> {
    constructor() {
        super(recommendationModel);
    }
}

export default RecommendationService;
