import { Router } from "express";
import requestValidator from "../../../../middlewares/requestValidator.middleware";
import UserController from "../../controllers/users/user.controller";
import { sentOTPValidator, verifyOTPValidator } from "../../validators/users/otp.validator";
import googleAuthValidator from "../../validators/users/googleAuth.validator";

const userRouter = Router();
const getUserController = new UserController();
userRouter.post(
    "/auth/send-otp",
    requestValidator(sentOTPValidator),
    getUserController.sendOTPToPhone,
);
userRouter.post(
    "/auth/verify-otp",
    requestValidator(verifyOTPValidator),
    getUserController.verifyOTP,
);
userRouter.post(
    "/auth/google",
    requestValidator(googleAuthValidator),
    getUserController.googleAuth,
);

export default userRouter;
