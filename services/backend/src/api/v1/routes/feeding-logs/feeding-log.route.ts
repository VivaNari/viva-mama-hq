import { Router } from "express";

import authMiddleware from "../../../../middlewares/authorization.middleware";
import requestValidator from "../../../../middlewares/requestValidator.middleware";
import FeedingLogController from "../../controllers/feeding-log/feeding-log.controller";
import {
    feedingLogCreateValidator,
    feedingLogDeleteValidator,
    feedingLogSettingsValidator,
} from "../../validators/feeding-log/feeding-log.validator";

const feedingLogRouter = Router();
const feedingLogController = new FeedingLogController();

/**
 * Infant feeding logs, scoped to a child of the authenticated user.
 *
 * One POST for all three entry kinds — milk feeds, solids and water — discriminated on
 * `kind` in the body. Three sub-resources would have tripled the route surface for three
 * writes that differ only in which array they append to.
 *
 * POST appends rather than replacing a day. Partner accounts exist in this product, so two
 * people logging the same baby's day at once is ordinary, and a whole-day write would drop
 * whichever entry lost the race.
 *
 * `/settings` writes the child rather than a log row, and sits here rather than under
 * /child because it is this feature's own state: how the baby is fed, and whether solids
 * have started.
 */
feedingLogRouter.get(
    "/feeding-logs",
    authMiddleware("header"),
    feedingLogController.getChildFeedingLogs,
);

feedingLogRouter.post(
    "/feeding-logs",
    authMiddleware("header"),
    requestValidator(feedingLogCreateValidator),
    feedingLogController.createFeedingLogEntry,
);

feedingLogRouter.delete(
    "/feeding-logs",
    authMiddleware("header"),
    requestValidator(feedingLogDeleteValidator),
    feedingLogController.deleteFeedingLogEntry,
);

feedingLogRouter.patch(
    "/feeding-logs/settings",
    authMiddleware("header"),
    requestValidator(feedingLogSettingsValidator),
    feedingLogController.updateFeedingSettings,
);

export default feedingLogRouter;
