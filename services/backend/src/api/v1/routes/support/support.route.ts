import { Router } from "express";
import authMiddleware from "../../../../middlewares/authorization.middleware";
import { SupportController } from "../../controllers/support/support.controller";
import requestValidator from "../../../../middlewares/requestValidator.middleware";
import createSupportValidator from "../../validators/support/create-support.validator";

const supportRouter = Router();
const supportController = new SupportController();

supportRouter.post(
    "/support",
    requestValidator(createSupportValidator),
    authMiddleware("header"),
    supportController.createSupport,
);

supportRouter.put(
    "/support/:id/resolve",
    authMiddleware("header"),
    supportController.resolveSupport,
);

export default supportRouter;
