import { Router } from "express";
import authMiddleware from "../../../../middlewares/authorization.middleware";
import adminAuthMiddleware from "../../../../middlewares/adminAuthorization.middleware";
import requestValidator from "../../../../middlewares/requestValidator.middleware";
import { ExpertController } from "../../controllers/expert/expert.controller";
import createExpertValidator from "../../validators/experts/expert.validator";

const expertRouter = Router();
const expertController = new ExpertController();

expertRouter.get("/experts", authMiddleware("header"), expertController.getExperts);
expertRouter.get("/expert/:id", authMiddleware("header"), expertController.getExpertById);
// adminAuthMiddleware, not authMiddleware: this used to accept any logged-in user's
// token despite the /admin prefix. Creating an expert now also means minting a referral
// code, and a code can carry a paid subscription.
//
// Auth runs before validation so an unauthenticated caller gets 401 rather than a 400
// that tells them the body shape.
expertRouter.post(
    "/admin/experts",
    adminAuthMiddleware,
    requestValidator(createExpertValidator),
    expertController.createExpert,
);

export default expertRouter;
