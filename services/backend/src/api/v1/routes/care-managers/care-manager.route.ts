import { Router } from "express";
import authMiddleware from "../../../../middlewares/authorization.middleware";
import requestValidator from "../../../../middlewares/requestValidator.middleware";
import { CareManagerController } from "../../controllers/care-manager/care-manager.controller";
import createCareManagerValidator from "../../validators/care-manager/care-manager.validator";
const careManagerRouter = Router();
const careManagerController = new CareManagerController();

careManagerRouter.get(
    "/care-managers",
    authMiddleware("header"),
    careManagerController.getCareManagers,
);
careManagerRouter.get(
    "/care-manager/:id",
    authMiddleware("header"),
    careManagerController.getCareManagerById,
);
careManagerRouter.post(
    "/admin/care-managers",
    requestValidator(createCareManagerValidator),
    authMiddleware("header"),
    careManagerController.createCareManager,
);

export default careManagerRouter;
