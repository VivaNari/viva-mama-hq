import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import env from "../config/env";
import { IUser } from "../types";
declare global {
    namespace Express {
        interface Request {
            user?: IUser;
        }
    }
}
const authMiddleware = () => {
    return async (req: Request, res: Response, next: NextFunction) => {
        try {
            const authHeader = req.headers["authorization"];
            const token = authHeader?.split(" ")[1];
            if (!token) {
                return res.status(401).json({
                    success: false,
                    message: "Unautorize access denied",
                });
            }

            jwt.verify(token, env.JWT_SECRET as string, (err, user) => {
                if (err) {
                    return res.status(403).json({
                        success: false,
                        message: "Invalid Token!",
                    });
                }
                console.log("user from middleware", user);
                req.user = user as any;
                next();
            });
        } catch (errors: any) {
            console.log(errors);
            return res.status(400).json({
                error: errors,
            });
        }
    };
};

export default authMiddleware;
