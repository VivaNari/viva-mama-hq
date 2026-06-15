import { Router } from "express";
import authMiddleware from "../../../../middlewares/authorization.middleware";
import requestValidator from "../../../../middlewares/requestValidator.middleware";
import { ExpertController } from "../../controllers/expert/expert.controller";
import createExpertValidator from "../../validators/experts/expert.validator";

const expertRouter = Router();
const expertController = new ExpertController();

expertRouter.get("/experts", authMiddleware("header"), expertController.getExperts);
expertRouter.get("/expert/:id", authMiddleware("header"), expertController.getExpertById);
expertRouter.post(
    "/admin/experts",
    requestValidator(createExpertValidator),
    authMiddleware("header"),
    expertController.createExpert,
);

export default expertRouter;
