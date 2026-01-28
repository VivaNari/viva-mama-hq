import { Schema } from "mongoose";
import { IOTP } from "../../types";

const OTPSchema = new Schema<IOTP>(
    {
        otp: { type: String },
        expiration_time: { type: Date },
        verified: { type: Boolean, default: false },
    },
    { timestamps: true },
);

export default OTPSchema;
