import jwt from "jsonwebtoken";
import env from "../../config/env";
import mongoose, { ObjectId } from "mongoose";

export const generateJWT = (
    user_id: mongoose.Types.ObjectId,
    mobile_number: string,
    email: string,
) => {
    const token = jwt.sign(
        {
            user_id,
            mobile_number,
            email,
        },
        env.JWT_SECRET as string,
        {
            expiresIn: "7d",
        },
    );

    return token;
};
