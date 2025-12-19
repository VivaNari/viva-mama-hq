import { Router } from "express";
import authMiddleware from "../../../../middlewares/authorization.middleware";
import requestValidator from "../../../../middlewares/requestValidator.middleware";
import { ContentController } from "../../controllers/contents/content.controller";
import createContentValidator from "../../validators/content/content.validator";

const contentRouter = Router();
const getContentController = new ContentController();

contentRouter.get("/contents", authMiddleware("header"), getContentController.getContents);
contentRouter.post(
    "/admin/contents",
    requestValidator(createContentValidator),
    authMiddleware("header"),
    getContentController.createContent,
);

export default contentRouter;
