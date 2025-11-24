import jwt from "jsonwebtoken";
import env from "../../config/env";
import { IUser } from "../../types"; // Adjust this import path if needed

export const generateJWT = (user: IUser): string => {
    const payload = {
        _id: user._id,
        email: user.email ?? null,
        mobile_number: user.mobile_number ?? null,
        is_onboarded: user.is_onboarded,
        user_id: user.user_id,
    };

    const token = jwt.sign(payload, env.JWT_SECRET as string, {
        expiresIn: "7d",
    });

    return token;
};
