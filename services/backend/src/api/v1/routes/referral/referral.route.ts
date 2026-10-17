import { Router } from "express";

import ReferralController from "../../controllers/referral/referral.controller";
import authMiddleware from "../../../../middlewares/authorization.middleware";
import requestValidator from "../../../../middlewares/requestValidator.middleware";
import { redeemReferralValidator } from "../../validators/referral/referral.validator";

const referralRouter = Router();
const referralController = new ReferralController();

referralRouter.post(
    "/referral/redeem",
    authMiddleware("header"),
    requestValidator(redeemReferralValidator),
    referralController.redeem,
);

export default referralRouter;
