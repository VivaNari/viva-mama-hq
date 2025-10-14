import { NextFunction, Request, Response } from "express";
import UserService from "../../../../services/users/user.service";

const getUserService = new UserService();

export default class UserController {
    login = async (req: Request, res: Response, next: NextFunction) => {
        await getUserService.login(res);
    };

    sendOTPToPhone = async (req: Request, res: Response) => {
        await getUserService.sendOTPToPhone(req, res);
    };
    verifyOTP = async (req: Request, res: Response) => {
        await getUserService.verifyOTP(req, res);
    };

    googleAuth = async (req: Request, res: Response) => {
        await getUserService.googleAuth(req, res);
    };
}
