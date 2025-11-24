import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import env from "../config/env";
import { IUser, TTokenSource } from "../types";
import sendResponse from "../utils/commonFunctions/sendResponse";
import { messages } from "../constants/messages";
import { StatusCodes } from "http-status-codes";

const authMiddleware = (tokenSource: TTokenSource) => {
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
                return sendResponse({
                    data: null,
                    message: messages.TOKEN_MISSING,
                    success: false,
                    statusCode: StatusCodes.UNAUTHORIZED,
                    response: res,
                });
            }

            jwt.verify(token, env.JWT_SECRET as string, (err, user) => {
                if (err) {
                    return sendResponse({
                        data: null,
                        message: messages.TOKEN_INVALID,
                        success: false,
                        statusCode: StatusCodes.FORBIDDEN,
                        response: res,
                    });
                }

                req.user = user as any;
                next();
            });
        } catch (errors: any) {
            console.error("Authorization error:", errors);
            return sendResponse({
                data: null,
                message: messages.AUTH_BAD_REQUEST,
                success: false,
                statusCode: StatusCodes.BAD_REQUEST,
                response: res,
            });
        }
    };
};

export default authMiddleware;
