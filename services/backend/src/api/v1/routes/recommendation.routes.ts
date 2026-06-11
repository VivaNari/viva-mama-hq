import { Router } from "express";
import RecommendationController from "../controllers/recommendations/receommendation.controller";

const recommendationRouter = Router();
const recommendationController = new RecommendationController();

recommendationRouter.route("/admin/recommendations").post(recommendationController.create);

export default recommendationRouter;
