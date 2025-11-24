import { Router } from "express";
import authMiddleware from "../../../../middlewares/authorization.middleware";
import requestValidator from "../../../../middlewares/requestValidator.middleware";
import ChildController from "../../controllers/childs/child.controller";
import childValidator from "../../validators/users/child.validator";

const childRouter = Router();
const getChildController = new ChildController();

childRouter.post(
    "/child",
    authMiddleware(),
    requestValidator(childValidator),
    getChildController.addChild,
);

export default childRouter;
