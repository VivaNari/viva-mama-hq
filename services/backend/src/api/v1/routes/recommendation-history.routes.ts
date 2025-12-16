import { Router } from "express";
import RecommendationhistoryController from "../controllers/recommendation-history/RecommendationHistoryController";
import authMiddleware from "../../../middlewares/authorization.middleware";

const recommendationHistoryRouter = Router();
const recommendationhistoryController = new RecommendationhistoryController();

recommendationHistoryRouter.get(
    "/user/recommendations",
    authMiddleware("header"),
    recommendationhistoryController.getAllrecommendations,
);
recommendationHistoryRouter.get(
    "/user/recommendations-formatted",
    authMiddleware("header"),
    recommendationhistoryController.getAllFormatedRecommendations,
);

export default recommendationHistoryRouter;
