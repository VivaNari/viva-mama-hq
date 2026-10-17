import { Router } from "express";
import VivaClubService from "../../../../services/vivaClub/vivaClub.service";
import authMiddleware from "../../../../middlewares/authorization.middleware";
import requestValidator from "../../../../middlewares/requestValidator.middleware";
import ModerationController from "../../controllers/vivaClub/moderation.controller";
import { createReportValidator } from "../../validators/vivaClub/moderation.validator";

const vivaClubRouter = Router();
const vivaClubService = new VivaClubService();
const moderationController = new ModerationController();

// All Viva Club routes require authentication
vivaClubRouter.use(authMiddleware());

vivaClubRouter.get("/posts", vivaClubService.getPosts);
vivaClubRouter.post("/posts", vivaClubService.createPost);
vivaClubRouter.get("/posts/:id", vivaClubService.getPostDetails);
vivaClubRouter.post("/posts/:id/comments", vivaClubService.addComment);
vivaClubRouter.post("/posts/:id/like", vivaClubService.toggleLike);

// ── Moderation ──────────────────────────────────────────────────────────────────
// Play's UGC policy requires an in-app way to report objectionable content, block
// other users, and remove your own posts. All of these act on the caller's identity
// from the bearer token; none of them take a user id for the actor.

vivaClubRouter.post(
    "/reports",
    requestValidator(createReportValidator),
    moderationController.createReport,
);

vivaClubRouter.delete("/posts/:id", moderationController.deletePost);
vivaClubRouter.delete("/posts/:postId/comments/:commentId", moderationController.deleteComment);

vivaClubRouter.post("/block/:userId", moderationController.blockUser);
vivaClubRouter.delete("/block/:userId", moderationController.unblockUser);

vivaClubRouter.get("/guidelines/status", moderationController.guidelinesStatus);
vivaClubRouter.post("/guidelines/accept", moderationController.acceptGuidelines);

export default vivaClubRouter;
