import { Request, Response } from "express";
import sendSMS from "../twilio/sendSMS";
import { addMinutesToDate } from "../date/date.service";
import { decode, encode } from "../crypto/crypto.service";
import OTPModel from "../../models/opt.model";
import UserModel from "../../models/user.model";
import { generateJWT } from "../../utils/functions/generateJWT";
import { OAuth2Client } from "google-auth-library";
import { IGoogleLoginPayload } from "../../types";

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

export default class UserService {
    login = async (res: Response) => {
        res.status(200).json({ message: "User logged in successfully" });
    };

    sendOTPToPhone = async (req: Request, res: Response) => {
        try {
            const { phone } = req.body as any;
            if (!phone) return res.status(400).json({ message: "Phone number is required" });

            const OTP = Math.floor(100000 + Math.random() * 900000).toString();
            const now = Date.now();
            const expirationTime = addMinutesToDate(now, 10);

            const otpDoc = await OTPModel.create({
                otp: OTP,
                expiration_time: expirationTime,
            });

            const payload = {
                otp_id: otpDoc._id,
                check: phone,
                timestamp: Date.now(),
                message: "OTP sent successfully",
            };

            const verification_key = await encode(JSON.stringify(payload));

            const ok = await sendSMS(
                phone,
                `Your VivaMama OTP is ${OTP}. It expires in 10 minutes.`,
            );
            if (ok) {
                return res.status(200).json({
                    message: "OTP sent successfully",
                    success: true,
                    verification_key,
                });
            } else {
                return res.status(500).json({
                    message: "Failed to send OTP",
                    success: false,
                });
            }
        } catch (error: any) {
            console.error("sendOTPToPhone error:", error);
            return res.status(500).json({
                message: "Failed to send OTP",
                success: false,
                error: error.message,
            });
        }
    };

    verifyOTP = async (req: Request, res: Response) => {
        try {
            const { verification_key, otp, phone } = req.body as any;
            if (!verification_key || !otp || !phone)
                return res.status(400).json({ message: "Missing fields" });

            const decoded = await decode(verification_key);
            const data = JSON.parse(decoded);

            if (data.check !== phone)
                return res.status(400).json({ message: "OTP not sent to this phone" });

            const otpDoc = await OTPModel.findById(data.otp_id);
            if (!otpDoc) return res.status(400).json({ message: "Invalid verification key" });

            if (otpDoc.verified) return res.status(400).json({ message: "OTP already used" });

            if (otpDoc.expiration_time < new Date())
                return res.status(400).json({ message: "OTP expired" });

            if (otpDoc.otp !== otp) return res.status(400).json({ message: "Incorrect OTP" });

            otpDoc.verified = true;
            await otpDoc.save();

            // find user
            let user = await UserModel.findOne({ mobile_number: phone });

            // If first-time, create new user
            if (!user) {
                user = await UserModel.create({ mobile_number: phone });
                console.log("First-time user created:", user._id);
            }

            const jwt = generateJWT(user._id, user.mobile_number, user.email);

            return res.status(200).json({
                message: "OTP verified successfully",
                token: jwt,
            });
        } catch (error: any) {
            console.error("verifyOTP error:", error);
            return res
                .status(500)
                .json({ message: "OTP verification failed", error: error.message });
        }
    };

    googleAuth = async (req: Request, res: Response) => {
        try {
            const { idToken } = req.body;

            // VERIFY THE GOOGLE ID TOKEN
            const ticket = await client.verifyIdToken({
                idToken,
            });

            const payload = ticket.getPayload() as IGoogleLoginPayload;
            console.log("Payload", payload);
            const { name, email, picture } = payload;

            // FIND OR CREATE USER IN DATABASE
            const user = await UserModel.findOneAndUpdate(
                { email: email },
                {
                    name: name,
                    profile_pic: picture,
                },
                {
                    upsert: true, // Create a new doc if no match is found
                    new: true, // Return the new or updated doc
                    setDefaultsOnInsert: true, // Apply default values (like is_onboarded: false)
                },
            );

            const jwt = generateJWT(user._id, user.mobile_number, user.email);

            return res.status(200).json({
                message: "Logged in successfully",
                token: jwt,
            });
        } catch (error) {
            console.error("Google Sign-In Error:", error);
            res.status(401).json({ message: "Invalid Google token." });
        }
    };
}
