import { Router } from "express";
import adminAuthMiddleware from "../../../../middlewares/adminAuthorization.middleware";
import authMiddleware from "../../../../middlewares/authorization.middleware";
import requestValidator from "../../../../middlewares/requestValidator.middleware";
import { ContentController } from "../../controllers/contents/content.controller";
import createContentValidator from "../../validators/content/content.validator";

const contentRouter = Router();
const getContentController = new ContentController();

contentRouter.get("/contents", authMiddleware("header"), getContentController.getContents);
contentRouter.get("/contents/:id", authMiddleware("header"), getContentController.getContentById);
contentRouter.post(
    "/admin/contents",
    adminAuthMiddleware,
    requestValidator(createContentValidator),
    getContentController.createContent,
);

export default contentRouter;
