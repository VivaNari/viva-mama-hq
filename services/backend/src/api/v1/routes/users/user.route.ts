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

// Play's User Data policy requires an in-app account deletion path. Deliberately takes
// no id — the account deleted is always the one the bearer token authenticates as.
userRouter.delete("/user/me", authMiddleware("header"), userController.deleteMyAccount);

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

userRouter.patch(
    "/dashboard/emergency-alert/:id/dismiss",
    authMiddleware("header"),
    userController.dismissEmergencyAlert,
);

userRouter.put("/user/update-user-data", authMiddleware("header"), userController.updateUserData);
// POST /user/map-expert-referral was removed. It resolved codes against
// `experts.referralCode`, which made that field a second source of truth alongside
// `referral_programs.code` — two codes could exist for one doctor, only one of which
// carried a plan. POST /referral/redeem replaces it.

export default userRouter;
