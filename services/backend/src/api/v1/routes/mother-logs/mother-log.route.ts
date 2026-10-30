import { Router } from "express";

import authMiddleware from "../../../../middlewares/authorization.middleware";
import requestValidator from "../../../../middlewares/requestValidator.middleware";
import ChatLogProposalController from "../../controllers/mother-log/chat-log-proposal.controller";
import MotherLogController from "../../controllers/mother-log/mother-log.controller";
import MotherMedicineController from "../../controllers/mother-log/mother-medicine.controller";
import MotherReminderController from "../../controllers/mother-log/mother-reminder.controller";
import {
    ancScheduleItemValidator,
    chatLogConfirmValidator,
    motherLogCreateValidator,
    motherLogDailyValidator,
    motherMedicineCreateValidator,
    motherMedicineTakenValidator,
    motherReminderCreateValidator,
} from "../../validators/mother-log/mother-log.validator";

const motherLogRouter = Router();
const motherLogController = new MotherLogController();
const motherMedicineController = new MotherMedicineController();
const chatLogProposalController = new ChatLogProposalController();
const motherReminderController = new MotherReminderController();

/**
 * The mother's own logs (the Viva AI "Log something" screens), one engine for every
 * type. Appended types are a POST each; the tap counters (water, kicks) PUT a running
 * daily total; medicine doses and ANC schedule ticks are toggles with their own routes.
 *
 * Static paths are declared before `/:id` so "daily" and "anc-schedule" are never read
 * as an id.
 */
motherLogRouter.get("/mother-logs", authMiddleware("header"), motherLogController.getLogs);

motherLogRouter.post(
    "/mother-logs",
    authMiddleware("header"),
    requestValidator(motherLogCreateValidator),
    motherLogController.createLog,
);

motherLogRouter.put(
    "/mother-logs/daily",
    authMiddleware("header"),
    requestValidator(motherLogDailyValidator),
    motherLogController.setDaily,
);

motherLogRouter.get(
    "/mother-logs/anc-schedule",
    authMiddleware("header"),
    motherLogController.getAncSchedule,
);

motherLogRouter.put(
    "/mother-logs/anc-schedule/:itemId",
    authMiddleware("header"),
    requestValidator(ancScheduleItemValidator),
    motherLogController.setAncScheduleItem,
);

motherLogRouter.delete("/mother-logs/:id", authMiddleware("header"), motherLogController.deleteLog);

motherLogRouter.get(
    "/mother-medicines",
    authMiddleware("header"),
    motherMedicineController.getMedicines,
);

motherLogRouter.post(
    "/mother-medicines",
    authMiddleware("header"),
    requestValidator(motherMedicineCreateValidator),
    motherMedicineController.addMedicine,
);

motherLogRouter.put(
    "/mother-medicines/:id/taken",
    authMiddleware("header"),
    requestValidator(motherMedicineTakenValidator),
    motherMedicineController.setTaken,
);

/** Reminders she set; the custom-reminders job pushes them at the chosen slot. */
motherLogRouter.get(
    "/mother-reminders",
    authMiddleware("header"),
    motherReminderController.getReminders,
);

motherLogRouter.post(
    "/mother-reminders",
    authMiddleware("header"),
    requestValidator(motherReminderCreateValidator),
    motherReminderController.createReminder,
);

motherLogRouter.delete(
    "/mother-reminders/:id",
    authMiddleware("header"),
    motherReminderController.deleteReminder,
);

/** Her Yes / No on a log Viva proposed in chat ("today my bp is 118/80"). */
motherLogRouter.post(
    "/chat/log-proposals/confirm",
    authMiddleware("header"),
    requestValidator(chatLogConfirmValidator),
    chatLogProposalController.confirm,
);

export default motherLogRouter;
