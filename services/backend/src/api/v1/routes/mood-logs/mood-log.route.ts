import { Router } from "express";
import MoodLogController from "../../controllers/mood-log/mood-log.controller";
import authMiddleware from "../../../../middlewares/authorization.middleware";
import requestValidator from "../../../../middlewares/requestValidator.middleware";
import {
    moodLogDeleteValidator,
    moodLogUpsertValidator,
} from "../../validators/mood-log/mood-log.validator";

const moodLogRouter = Router();
const moodLogController = new MoodLogController();

moodLogRouter.get("/mood-logs", authMiddleware("header"), moodLogController.getUserMoodLogs);

moodLogRouter.post(
    "/mood-logs",
    authMiddleware("header"),
    requestValidator(moodLogUpsertValidator),
    moodLogController.createOrUpdateMoodLog,
);

moodLogRouter.delete(
    "/mood-logs",
    authMiddleware("header"),
    requestValidator(moodLogDeleteValidator),
    moodLogController.deleteMoodLog,
);

export default moodLogRouter;
