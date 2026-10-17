import { Router } from "express";

import authMiddleware from "../../../../middlewares/authorization.middleware";
import requestValidator from "../../../../middlewares/requestValidator.middleware";
import GrowthLogController from "../../controllers/growth-log/growth-log.controller";
import {
    growthLogDeleteValidator,
    growthLogUpsertValidator,
} from "../../validators/growth-log/growth-log.validator";

const growthLogRouter = Router();
const growthLogController = new GrowthLogController();

/**
 * Infant growth logs, scoped to a child of the authenticated user.
 *
 * There is deliberately no endpoint serving the WHO reference curves: the app carries
 * @vivamama/growth-standards, so a chart that should render offline never waits on the
 * network to draw its axes.
 */
growthLogRouter.get(
    "/growth-logs",
    authMiddleware("header"),
    growthLogController.getChildGrowthLogs,
);

growthLogRouter.post(
    "/growth-logs",
    authMiddleware("header"),
    requestValidator(growthLogUpsertValidator),
    growthLogController.createOrUpdateGrowthLog,
);

growthLogRouter.delete(
    "/growth-logs",
    authMiddleware("header"),
    requestValidator(growthLogDeleteValidator),
    growthLogController.deleteGrowthLog,
);

export default growthLogRouter;
