import { Router } from "express";
import authMiddleware from "../../../../middlewares/authorization.middleware";
import requestValidator from "../../../../middlewares/requestValidator.middleware";
import ChildController from "../../controllers/childs/child.controller";
import childValidator, {
    childUpdateValidator,
} from "../../validators/users/child.validator";

const childRouter = Router();
const getChildController = new ChildController();

/**
 * Children live embedded on the user, so GET /api/v1/user already returns them and the
 * app reads them from there. The list route below is for callers that want children
 * without pulling the whole profile; it is not what the dashboard uses.
 */
childRouter.post(
    "/child",
    authMiddleware(),
    requestValidator(childValidator),
    getChildController.addChild,
);

childRouter.get("/child", authMiddleware(), getChildController.listChildren);

childRouter.patch(
    "/child/:childId",
    authMiddleware(),
    requestValidator(childUpdateValidator),
    getChildController.updateChild,
);

childRouter.delete("/child/:childId", authMiddleware(), getChildController.deleteChild);

export default childRouter;
