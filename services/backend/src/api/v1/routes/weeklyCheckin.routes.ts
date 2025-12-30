import { Router } from "express";
import WeeklyCheckinController from "../controllers/weeklyCheckin/weeklyCheckin.controller";
import authMiddleware from "../../../middlewares/authorization.middleware";

const weeklyCheckinController = new WeeklyCheckinController();

const router = Router();

router.route("/stream").get(authMiddleware("header"), weeklyCheckinController.handleSSEConnection);
router.route("/answer").post(authMiddleware("header"), weeklyCheckinController.processAnswer);
router.route("/status").get(authMiddleware("header"), weeklyCheckinController.getCheckinStatus);

export default router;
