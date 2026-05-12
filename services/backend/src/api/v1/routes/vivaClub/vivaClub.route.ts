import { Router } from "express";
import VivaClubService from "../../../../services/vivaClub/vivaClub.service";
import authMiddleware from "../../../../middlewares/authorization.middleware";

const vivaClubRouter = Router();
const vivaClubService = new VivaClubService();

// All Viva Club routes require authentication
vivaClubRouter.use(authMiddleware());

vivaClubRouter.get("/posts", vivaClubService.getPosts);
vivaClubRouter.post("/posts", vivaClubService.createPost);
vivaClubRouter.get("/posts/:id", vivaClubService.getPostDetails);
vivaClubRouter.post("/posts/:id/comments", vivaClubService.addComment);
vivaClubRouter.post("/posts/:id/like", vivaClubService.toggleLike);

export default vivaClubRouter;
