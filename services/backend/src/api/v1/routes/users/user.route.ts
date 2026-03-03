import { Router } from "express";
import requestValidator from "../../../../middlewares/requestValidator.middleware";
import UserController from "../../controllers/users/user.controller";
import googleAuthValidator from "../../validators/users/googleAuth.validator";
import { sentOTPValidator, verifyOTPValidator } from "../../validators/users/otp.validator";
import authMiddleware from "../../../../middlewares/authorization.middleware";

const userRouter = Router();
const userController = new UserController();

userRouter.get("/user", authMiddleware(), userController.getUserbyAuthToken);

userRouter.put("/user/update-fcm-token", authMiddleware(), userController.updateFCMToken);

userRouter.post(
    "/auth/send-otp",
    requestValidator(sentOTPValidator),
    userController.sendOTPToPhone,
);

userRouter.post("/auth/verify-otp", requestValidator(verifyOTPValidator), userController.verifyOTP);

userRouter.post("/auth/google", requestValidator(googleAuthValidator), userController.googleAuth);

userRouter.get(
    "/dashboard/viva-score",
    authMiddleware("header"),
    userController.getCheckinScoreData,
);

userRouter.put("/user/update-user-data", authMiddleware("header"), userController.updateUserData);

export default userRouter;
