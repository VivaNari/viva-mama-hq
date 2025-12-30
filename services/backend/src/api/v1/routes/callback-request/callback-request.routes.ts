import { Router } from "express";
import authMiddleware from "../../../../middlewares/authorization.middleware";
import requestValidator from "../../../../middlewares/requestValidator.middleware";
import { CallbackRequestController } from "../../controllers/callback-request/callback-request.controller";
import addcallbackRequestValidator from "../../validators/callback-request/callback-request.validator";

const callbackRequestRouter = Router();
const getCallbackRequestController = new CallbackRequestController();

callbackRequestRouter.post(
    "/callback-request",
    authMiddleware(),
    requestValidator(addcallbackRequestValidator),
    getCallbackRequestController.requestCallback,
);

export default callbackRequestRouter;
