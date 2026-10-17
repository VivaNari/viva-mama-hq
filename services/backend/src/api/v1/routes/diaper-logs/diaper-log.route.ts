import { Router } from "express";

import authMiddleware from "../../../../middlewares/authorization.middleware";
import requestValidator from "../../../../middlewares/requestValidator.middleware";
import DiaperLogController from "../../controllers/diaper-log/diaper-log.controller";
import {
    diaperLogCreateValidator,
    diaperLogDeleteValidator,
} from "../../validators/diaper-log/diaper-log.validator";

const diaperLogRouter = Router();
const diaperLogController = new DiaperLogController();

/**
 * Infant diaper logs, scoped to a child of the authenticated user.
 *
 * POST appends one change rather than replacing a day — this screen is tapped repeatedly
 * and fast, and a whole-day write would drop entries whenever two taps overlapped.
 */
diaperLogRouter.get(
    "/diaper-logs",
    authMiddleware("header"),
    diaperLogController.getChildDiaperLogs,
);

diaperLogRouter.post(
    "/diaper-logs",
    authMiddleware("header"),
    requestValidator(diaperLogCreateValidator),
    diaperLogController.createDiaperLogEntry,
);

diaperLogRouter.delete(
    "/diaper-logs",
    authMiddleware("header"),
    requestValidator(diaperLogDeleteValidator),
    diaperLogController.deleteDiaperLogEntry,
);

export default diaperLogRouter;
