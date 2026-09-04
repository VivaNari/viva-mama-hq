import { Request, Response } from "express";
import { OAuth2Client } from "google-auth-library";
import { StatusCodes } from "http-status-codes";
import env from "../../config/env";
import { NNWomanRecoveryScoreText } from "../../constants/NNWomenRecoveryScoreText";
import { caremanager } from "../../constants/careManager";
import { CARE_MANAGER_DEFAULT_REMUNERATION } from "../../constants/care-manager";
import { messages } from "../../constants/messages";
import careManagerModel from "../../models/care-manager.model";
import { recoveryScoreBriefInfo } from "../../constants/recoveryScoreBriefInfo";
import { significance } from "../../constants/significance";
import OTPModel from "../../models/opt.model";
import UserModel from "../../models/user.model";
import flowInstanceModel from "../../models/flowInstance.model";
import { WEEKLY_CHECKIN_SLUG } from "../../constants/chat";
import { FlowInstanceStateEnum } from "../../types/chat.types";
import { EUserCategory } from "../../types/user.types";
import {
    calculatePostpartumState,
    daysLeftToAnswer,
    isCheckinEligibleWeek,
    MAX_CHECKIN_WEEK,
} from "../../utils/functions/postpartumWeek";
import { entitlementService } from "../entitlements/entitlement.service";
import { ESubscriptionTier } from "../../types/subscription.types";
import { EUserRole, IGoogleLoginPayload, IUser } from "../../types";
import sendResponse from "../../utils/commonFunctions/sendResponse";
import { generateJWT } from "../../utils/functions/generateJWT";
import BaseService from "../base.service";
import { decode, encode } from "../crypto/crypto.service";
import { addMinutesToDate } from "../date/date.service";
import { sendWhatsappMessageForOTP } from "../getgabs/sendWhatsappMessageForOTP";

const client = new OAuth2Client(env.GOOGLE_CLIENT_ID);

/**
 * Identifies testing phone numbers that contain the same digit 6+ times consecutively.
 * @param phoneNumber - User mobile number.
 */
const isTestingPhoneNumber = (phoneNumber: string): boolean => /(\d)\1{5,}/.test(phoneNumber);

export default class UserService extends BaseService<IUser> {
    constructor() {
        super(UserModel);
    }

    /**
     * The check-in that is open for the user's current week, if any.
     *
     * Open means the instance exists and is not finished — PENDING (created by the week
     * job, never opened) or ACTIVE (started, partly answered). Returns null once she
     * completes it, which is what flips the dashboard from "complete your check-in" to
     * "next check-in in N days".
     */
    private resolveActiveCheckin = async (
        user: IUser | null,
    ): Promise<{ week: number; state: string; daysLeft: number } | null> => {
        const deliveryDate = user?.onboarding_data?.delivery_date;
        if (!user || !deliveryDate) return null;

        // Postpartum only, questionnaire finished, and inside the window the start
        // endpoint will actually accept (weeks 1-52).
        if (user.user_category !== EUserCategory.PP) return null;
        if (!user.is_onboarded?.is_questionnaire_completed) return null;

        const state = calculatePostpartumState(deliveryDate as Date);
        if (!isCheckinEligibleWeek(state)) return null;

        // FREE has no check-in entitlement. resolveTier is date-lazy and reads the
        // snapshot already on `user`, so this costs no extra query.
        if (entitlementService.resolveTier(user) === ESubscriptionTier.FREE) return null;

        const instance = await flowInstanceModel
            .findOne({
                userId: user._id,
                flowSlug: WEEKLY_CHECKIN_SLUG,
                postpartumWeek: state.weeks,
            })
            .select("state postpartumWeek")
            .lean();

        // Already done, or its week lapsed before she got to it.
        if (
            instance &&
            instance.state !== FlowInstanceStateEnum.PENDING &&
            instance.state !== FlowInstanceStateEnum.ACTIVE
        ) {
            return null;
        }

        // No row yet is still OPEN, not closed. Two real cases reach here: the nightly job
        // has not run for this week, and — the one that actually costs money — she
        // upgraded from FREE partway through the week, so no instance was ever created
        // for her. Reporting null would have left a paying user staring at a disabled
        // button until midnight. The start endpoint creates the instance on demand.
        return {
            week: state.weeks,
            state: instance?.state ?? FlowInstanceStateEnum.PENDING,
            daysLeft: daysLeftToAnswer(state),
        };
    };

    /**
     * True once she is past the end of the 52-week programme.
     *
     * The app hides the check-in section entirely on this rather than testing the week
     * number itself — the ceiling lives in one place on the server, so extending the
     * programme later is a server change, not an app-store release.
     *
     * Distinct from `active_checkin === null`, which also means "already done this week"
     * and should still show the countdown to the next one.
     */
    private isCheckinProgrammeOver = (user: IUser | null): boolean => {
        const deliveryDate = user?.onboarding_data?.delivery_date;
        if (!user || !deliveryDate || user.user_category !== EUserCategory.PP) return false;

        const state = calculatePostpartumState(deliveryDate as Date);
        return state.mode === "postpartum" && state.weeks > MAX_CHECKIN_WEEK;
    };

    getUserbyAuthToken = async (req: Request, res: Response) => {
        try {
            if (!req.user) {
                throw new Error(messages.USER_FETCH_FAILED);
            }
            const user = await UserModel.findById(req.user._id).lean();

            // `np_weeks` is weeks REMAINING until the due date — a different quantity
            // from the gestational age in current_weekdays.weeks. The NP dashboard reads
            // it for "your baby is coming in N weeks".
            //
            // This used to `return 0` when the due date had passed, which returned from
            // the handler without ever sending a response: the request simply hung.
            let np_weeks = 0;
            const deliveryDate = user?.onboarding_data?.delivery_date;

            if (user?.user_category === EUserCategory.NP && deliveryDate) {
                np_weeks = calculatePostpartumState(deliveryDate as Date).npWeeksRemaining;
            }
            // Whether a check-in is open right now, and for how much longer.
            //
            // The due-day counters alone cannot answer this — they are pure date maths and
            // say nothing about whether she already completed it. Without this the app can
            // only guess, which is why the dashboard button was gated on
            // `upcoming_checkin_due_days === 0` and so unlocked for exactly one day a week
            // instead of the whole week.
            const active_checkin = await this.resolveActiveCheckin(user);
            const checkin_programme_ended = this.isCheckinProgrammeOver(user);

            // The app needs the counsellor's fee to render "Pay ₹99" and to open a
            // Razorpay order when the user has no credit. Read from the document rather
            // than shipped as a constant, so changing a rate is a DB edit; the constant
            // remains the fallback for the window before the backfill has run.
            const careManagerDoc = await careManagerModel
                .findById(caremanager.id)
                .select("remuneration")
                .lean();

            sendResponse({
                data: {
                    user: { ...user, np_weeks, active_checkin, checkin_programme_ended },
                    significance,
                    recoveryScoreBriefInfo,
                    NNWomanRecoveryScoreText,
                    caremanager: {
                        ...caremanager,
                        remuneration:
                            careManagerDoc?.remuneration ?? CARE_MANAGER_DEFAULT_REMUNERATION,
                    },
                },
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

            await sendWhatsappMessageForOTP({
                to: fullPhoneNumber.replace("+", ""),
                otp: OTP,
            });

            return res.status(200).json({
                message: "OTP sent successfully",
                success: true,
                verification_key,
            });
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
            const { verification_key, otp, mobile_number, country_code, FCM_token, consents } =
                req.body;
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

            const isTestUser = isTestingPhoneNumber(mobile_number);
            const isOtpValidForUser = isTestUser ? otp === "123456" : otp === otpDoc.otp;
            if (!isOtpValidForUser) return res.status(400).json({ message: "Incorrect OTP" });

            otpDoc.verified = true;
            await otpDoc.save();

            // Same exclusion as the Google path: a staff account must never be
            // reachable through patient login, whatever it happens to hold.
            let user = await UserModel.findOne({
                mobile_number,
                role: { $ne: EUserRole.SUPER_ADMIN },
            });

            if (!user) {
                user = await UserModel.create({
                    mobile_number,
                    country_code,
                    FCM_token,
                    consents: consents || [],
                });
                console.log("First-time user created:", user._id);
            } else if (consents && consents.length > 0) {
                // Update consents if provided
                user = await UserModel.findByIdAndUpdate(
                    user._id,
                    {
                        $push: { consents: { $each: consents } },
                    },
                    { new: true },
                );
            }

            if (!user) {
                return res.status(404).json({ message: "User not found" });
            }

            const jwt = generateJWT(user as any);

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
            const { idToken, FCM_token, consents } = req.body;

            const ticket = await client.verifyIdToken({ idToken });
            const payload = ticket.getPayload() as IGoogleLoginPayload;

            const { name, email, picture } = payload;

            const updateData: any = {
                $set: {
                    user_name: name,
                    profile_picture: picture,
                    email: email,
                    FCM_token: FCM_token,
                },
            };

            if (consents && consents.length > 0) {
                updateData.$push = { consents: { $each: consents } };
            }

            // Staff accounts are keyed on this same `email` field. Without the role
            // exclusion, signing in here with an administrator's address would resolve
            // to their document and mint a token carrying role SUPER_ADMIN — the admin
            // password would be bypassable through Google. Excluded, this upserts a
            // separate ordinary account instead, which the admin-only partial index on
            // `email` permits.
            const user = await UserModel.findOneAndUpdate(
                { email: email, role: { $ne: EUserRole.SUPER_ADMIN } },
                updateData,
                {
                    upsert: true,
                    new: true,
                    setDefaultsOnInsert: true,
                },
            );

            if (!user) {
                return res.status(404).json({ message: "User could not be created/found" });
            }

            const jwt = generateJWT(user as any);

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
