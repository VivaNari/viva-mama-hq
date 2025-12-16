import { NextFunction, Request, Response } from "express";
import UserService from "../../../../services/users/user.service";

const getUserService = new UserService();

export default class UserController {
    getUserbyAuthToken = async (req: Request, res: Response, next: NextFunction) => {
        try {
            next(new Error("sdsdsd"));
            await getUserService.getUserbyAuthToken(req, res);
        } catch (err) {
            console.log("Hello", err);
            next(err);
        }
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

    getCheckinScoreData = async (req: Request, res: Response) => {
        await getUserService.getCheckinScoreData(req, res);
    };
}
