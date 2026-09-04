import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { StatusCodes } from "http-status-codes";
import env from "../config/env";
import userModel from "../models/user.model";
import { EUserRole, IJWTDecodedUser } from "../types";
import { messages } from "../constants/messages";
import sendResponse from "../utils/commonFunctions/sendResponse";

/**
 * Guards every `/api/v1/admin/*` route.
 *
 * Tokens are minted by the same `generateJWT` as the mobile app and signed with the
 * same secret, so the only thing separating an admin from a patient is the `role`
 * claim — which is why this checks it twice: once on the claim, and again against the
 * database. The second check costs one indexed lookup on a low-traffic surface and
 * means revoking an admin takes effect immediately instead of waiting out the token's
 * seven-day life.
 *
 * Tokens issued before roles existed simply have no `role` claim, and fall through to
 * the denial branch.
 */
const adminAuthMiddleware = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const authHeader = req.headers["authorization"];
        const token = authHeader?.split(" ")[1];

        if (!token) {
            return sendResponse({
                data: null,
                message: messages.TOKEN_MISSING,
                success: false,
                statusCode: StatusCodes.UNAUTHORIZED,
                response: res,
            });
        }

        let decoded: IJWTDecodedUser;
        try {
            decoded = jwt.verify(token, env.JWT_SECRET as string) as IJWTDecodedUser;
        } catch {
            return sendResponse({
                data: null,
                message: messages.TOKEN_INVALID,
                success: false,
                statusCode: StatusCodes.FORBIDDEN,
                response: res,
            });
        }

        if (decoded?.role !== EUserRole.SUPER_ADMIN) {
            return sendResponse({
                data: null,
                message: messages.ADMIN_ACCESS_DENIED,
                success: false,
                statusCode: StatusCodes.FORBIDDEN,
                response: res,
            });
        }

        const admin = await userModel.findById(decoded._id).select("role").lean();

        if (!admin || admin.role !== EUserRole.SUPER_ADMIN) {
            return sendResponse({
                data: null,
                message: messages.ADMIN_ACCESS_DENIED,
                success: false,
                statusCode: StatusCodes.FORBIDDEN,
                response: res,
            });
        }

        req.user = decoded;
        return next();
    } catch (errors) {
        console.error("Admin authorization error:", errors);
        return sendResponse({
            data: null,
            message: messages.AUTH_BAD_REQUEST,
            success: false,
            statusCode: StatusCodes.BAD_REQUEST,
            response: res,
        });
    }
};

export default adminAuthMiddleware;
