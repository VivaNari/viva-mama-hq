import { Router } from "express";

import authMiddleware from "../../../../middlewares/authorization.middleware";
import requestValidator from "../../../../middlewares/requestValidator.middleware";
import VaccinationLogController from "../../controllers/vaccination-log/vaccination-log.controller";
import {
    vaccinationLogRecordValidator,
    vaccinationLogRemoveValidator,
} from "../../validators/vaccination-log/vaccination-log.validator";

const vaccinationLogRouter = Router();
const vaccinationLogController = new VaccinationLogController();

/**
 * Immunisation doses, scoped to a child of the authenticated user.
 *
 * POST is an upsert on the dose rather than the day — a dose is given once, and re-recording
 * it corrects the date rather than adding a second row.
 */
vaccinationLogRouter.get(
    "/vaccination-logs",
    authMiddleware("header"),
    vaccinationLogController.getChildVaccinations,
);

vaccinationLogRouter.post(
    "/vaccination-logs",
    authMiddleware("header"),
    requestValidator(vaccinationLogRecordValidator),
    vaccinationLogController.recordDose,
);

vaccinationLogRouter.delete(
    "/vaccination-logs",
    authMiddleware("header"),
    requestValidator(vaccinationLogRemoveValidator),
    vaccinationLogController.removeDose,
);

export default vaccinationLogRouter;
