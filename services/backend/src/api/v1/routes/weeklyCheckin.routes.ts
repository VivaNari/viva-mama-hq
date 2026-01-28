import { Router } from "express";
import WeeklyCheckinController from "../controllers/weeklyCheckin/weeklyCheckin.controller";
import authMiddleware from "../../../middlewares/authorization.middleware";

const weeklyCheckinController = new WeeklyCheckinController();

const router = Router();

router
    .route("/weekly-checkin/stream")
    .get(authMiddleware("query"), weeklyCheckinController.handleSSEConnection);
router
    .route("/weekly-checkin/answer")
    .post(authMiddleware("header"), weeklyCheckinController.processAnswer);
router
    .route("/weekly-checkin/status")
    .get(authMiddleware("header"), weeklyCheckinController.getCheckinStatus);

export default router;
