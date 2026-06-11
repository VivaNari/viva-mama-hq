import { Router } from "express";
import BecknController from "../../controllers/beckn/beckn.controller";
import requestValidator from "../../../../middlewares/requestValidator.middleware";
import {
    becknSelectValidator,
    becknInitValidator,
    becknConfirmValidator,
    becknStatusValidator,
} from "../../validators/beckn/beckn.validator";

// Beckn BPP endpoints. NOT JWT-authed: trust is established at the ONIX adapter layer
// (signature verification), which forwards requests here as POST /api/v1/beckn/<action>.
// Each handler ACKs synchronously and dispatches its on_<action> callback to the BAP.
const becknRouter = Router();
const becknController = new BecknController();

becknRouter.post("/beckn/select", requestValidator(becknSelectValidator), becknController.select);
becknRouter.post("/beckn/init", requestValidator(becknInitValidator), becknController.init);
becknRouter.post("/beckn/confirm", requestValidator(becknConfirmValidator), becknController.confirm);
becknRouter.post("/beckn/status", requestValidator(becknStatusValidator), becknController.status);

export default becknRouter;
