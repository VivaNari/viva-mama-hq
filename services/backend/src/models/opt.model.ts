import { model } from "mongoose";
import OTPSchema from "./schema/otp.schema";
import { IOTP } from "../types";

const OTPModel = model<IOTP>("otps", OTPSchema);
export default OTPModel;
