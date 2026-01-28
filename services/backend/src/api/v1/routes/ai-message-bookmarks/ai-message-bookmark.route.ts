import { Router } from "express";
import AIBookmarkController from "../../controllers/ai-message-bookmark/ai-message-bookmark.controller";
import authMiddleware from "../../../../middlewares/authorization.middleware";
import aiMessageBookmarkValidator from "../../validators/ai-message-bookmark/ai-message-bookmark.validator";
import requestValidator from "../../../../middlewares/requestValidator.middleware";

const aiBookmarkRouter = Router();
const aiBookmarkController = new AIBookmarkController();

aiBookmarkRouter.get(
    "/ai-message-bookmarks",
    authMiddleware("header"),
    aiBookmarkController.getUserBookmarks,
);

aiBookmarkRouter.post(
    "/ai-message-bookmarks",
    authMiddleware("header"),
    requestValidator(aiMessageBookmarkValidator),
    aiBookmarkController.createBookmark,
);

aiBookmarkRouter.delete(
    "/ai-message-bookmarks",
    authMiddleware("header"),
    requestValidator(aiMessageBookmarkValidator),
    aiBookmarkController.deleteBookmark,
);

export default aiBookmarkRouter;
