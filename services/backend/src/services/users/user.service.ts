import { NextFunction, Request, Response } from "express";
import sendSMS from "../twilio/sendSMS";
import { addMinutesToDate } from "../date/date.service";
import { decode, encode } from "../crypto/crypto.service";
import OTPModel from "../../models/opt.model";
import UserModel from "../../models/user.model";
import { generateJWT } from "../../utils/functions/generateJWT";
import { OAuth2Client } from "google-auth-library";
import { IGoogleLoginPayload } from "../../types";
import env from "../../config/env";
import sendResponse from "../../utils/commonFunctions/sendResponse";
import { StatusCodes } from "http-status-codes";
import recommendationHistoryModel from "../../models/recommendation-history.model";
import { messages } from "../../constants/messages";
import { IRecommendationHistory } from "../../types/recommendation-history.types";

const client = new OAuth2Client(env.GOOGLE_CLIENT_ID);

export default class UserService {
    getUserbyAuthToken = async (req: Request, res: Response) => {
        try {
            if (!req.user) {
                throw new Error(messages.USER_FETCH_FAILED);
            }
            const user = await UserModel.findById(req.user._id);
            sendResponse({
                data: user,
                message: messages.USER_FETCHED_SUCCESSFULLY,
                response: res,
                statusCode: StatusCodes.OK,
                success: true,
            });
        } catch (err) {
            throw err;
        }
    };
    sendOTPToPhone = async (req: Request, res: Response) => {
        try {
            const { mobile_number, country_code, FCM_token } = req.body;
            if (!mobile_number || !country_code) {
                return res
                    .status(400)
                    .json({ message: "Country code and mobile number are required" });
            }

            const OTP = Math.floor(100000 + Math.random() * 900000).toString();
            const now = Date.now();
            const expirationTime = addMinutesToDate(now, 10);

            const otpDoc = await OTPModel.create({
                otp: OTP,
                expiration_time: expirationTime,
            });

            const payload = {
                otp_id: otpDoc._id,
                check: mobile_number,
                timestamp: Date.now(),
                message: "OTP sent successfully",
            };

            const verification_key = await encode(JSON.stringify(payload));

            const fullPhoneNumber = `${country_code}${mobile_number}`;

            const ok = await sendSMS(
                fullPhoneNumber,
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
            const { verification_key, otp, mobile_number, country_code, FCM_token } = req.body;
            if (!verification_key || !otp || !mobile_number || !country_code)
                return res.status(400).json({ message: "Missing required fields" });

            const decoded = await decode(verification_key);
            const data = JSON.parse(decoded);

            if (data.check !== mobile_number)
                return res.status(400).json({ message: "OTP not sent to this number" });

            const otpDoc = await OTPModel.findById(data.otp_id);
            if (!otpDoc) return res.status(400).json({ message: "Invalid verification key" });

            if (otpDoc.verified) return res.status(400).json({ message: "OTP already used" });

            if (otpDoc.expiration_time < new Date())
                return res.status(400).json({ message: "OTP expired" });

            if (otpDoc.otp !== otp) return res.status(400).json({ message: "Incorrect OTP" });

            otpDoc.verified = true;
            await otpDoc.save();

            let user = await UserModel.findOne({ mobile_number });

            if (!user) {
                user = await UserModel.create({
                    mobile_number,
                    country_code,
                    FCM_token,
                });
                console.log("First-time user created:", user._id);
            }

            const jwt = generateJWT(user);

            return res.status(200).json({
                message: "OTP verified successfully",
                token: jwt,
                is_onboarded: user.is_onboarded,
                user: user,
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
            const { idToken, FCM_token } = req.body;

            const ticket = await client.verifyIdToken({ idToken });
            const payload = ticket.getPayload() as IGoogleLoginPayload;

            const { name, email, picture } = payload;

            const user = await UserModel.findOneAndUpdate(
                { email: email },
                {
                    $set: {
                        user_name: name,
                        profile_picture: picture,
                        email: email,
                        FCM_token: FCM_token,
                    },
                },
                {
                    upsert: true,
                    new: true,
                    setDefaultsOnInsert: true,
                },
            );

            const jwt = generateJWT(user);

            return res.status(200).json({
                message: "Logged in successfully",
                token: jwt,
                is_onboarded: user.is_onboarded,
                user: user,
            });
        } catch (error) {
            console.error("Google Sign-In Error:", error);
            res.status(401).json({ message: "Invalid Google token." });
        }
    };
}
