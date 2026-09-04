import { Router } from "express";

import AnalyticsController from "../../controllers/analytics/analytics.controller";
import authMiddleware from "../../../../middlewares/authorization.middleware";
import cloudSchedulerMiddleware from "../../../../middlewares/cloudScheduler.middleware";
import requestValidator from "../../../../middlewares/requestValidator.middleware";
import { recordAnalyticsEventValidator } from "../../validators/analytics/analytics.validator";

const analyticsRouter = Router();
const analyticsController = new AnalyticsController();

analyticsRouter.post(
    "/analytics/events",
    authMiddleware("header"),
    requestValidator(recordAnalyticsEventValidator),
    analyticsController.recordEvent,
);

// Operator-only. Behind the same OIDC guard as the cron and migration endpoints
// rather than a user JWT — business metrics are not something any logged-in user
// should be able to read.
analyticsRouter.get("/analytics/funnel", cloudSchedulerMiddleware, analyticsController.getFunnel);

export default analyticsRouter;
