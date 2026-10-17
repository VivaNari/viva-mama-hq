import { Router } from "express";

import authMiddleware from "../../../../middlewares/authorization.middleware";
import requestValidator from "../../../../middlewares/requestValidator.middleware";
import MilestoneLogController from "../../controllers/milestone-log/milestone-log.controller";
import {
    milestoneLogAchieveValidator,
    milestoneLogForgetValidator,
} from "../../validators/milestone-log/milestone-log.validator";

const milestoneLogRouter = Router();
const milestoneLogController = new MilestoneLogController();

/**
 * Developmental milestones, scoped to a child of the authenticated user.
 *
 * POST is an upsert on the milestone rather than the day — a milestone is reached once, and
 * re-logging it corrects the date rather than adding a second row.
 */
milestoneLogRouter.get(
    "/milestone-logs",
    authMiddleware("header"),
    milestoneLogController.getChildMilestones,
);

milestoneLogRouter.post(
    "/milestone-logs",
    authMiddleware("header"),
    requestValidator(milestoneLogAchieveValidator),
    milestoneLogController.achieveMilestone,
);

milestoneLogRouter.delete(
    "/milestone-logs",
    authMiddleware("header"),
    requestValidator(milestoneLogForgetValidator),
    milestoneLogController.forgetMilestone,
);

export default milestoneLogRouter;
