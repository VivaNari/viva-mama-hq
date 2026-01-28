import { Router } from "express";
import requestValidator from "../../../../middlewares/requestValidator.middleware";
import UserController from "../../controllers/users/user.controller";
import googleAuthValidator from "../../validators/users/googleAuth.validator";
import { sentOTPValidator, verifyOTPValidator } from "../../validators/users/otp.validator";
import authMiddleware from "../../../../middlewares/authorization.middleware";

const userRouter = Router();
const getUserController = new UserController();
userRouter.get("/user", authMiddleware(), getUserController.getUserbyAuthToken);
userRouter.put("/user/update-fcm-token", authMiddleware(), getUserController.updateFCMToken);
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
userRouter.get(
    "/dashboard/viva-score",
    authMiddleware("header"),
    getUserController.getCheckinScoreData,
);

export default userRouter;
