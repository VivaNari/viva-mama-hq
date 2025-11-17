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
const authMiddleware = (tokenSource: "header" | "query" = "header") => {
    return async (req: Request, res: Response, next: NextFunction) => {
        try {
            let token: string | undefined;

            if (tokenSource === "header") {
                const authHeader = req.headers["authorization"];
                token = authHeader?.split(" ")[1];
            } else if (tokenSource === "query") {
                token = req.query.token as string;
            }

            if (!token) {
                return res.status(401).json({
                    success: false,
                    message: "Unauthorized: Access denied. Token missing.",
                });
            }

            jwt.verify(token, env.JWT_SECRET as string, (err, user) => {
                if (err) {
                    return res.status(403).json({
                        success: false,
                        message: "Forbidden: Invalid Token!",
                    });
                }

                req.user = user as any;
                next();
            });
        } catch (errors: any) {
            console.error("Authorization error:", errors);
            return res.status(400).json({
                success: false,
                message: "Bad Request: Error processing authorization.",
                error: errors.message,
            });
        }
    };
};

export default authMiddleware;
