import { NextFunction, Request, Response } from "express";
import { Types } from "mongoose";
import UserService from "../../../../services/users/user.service";
import {
    AccountDeletionService,
    accountDeletionService,
} from "../../../../services/users/account-deletion.service";
import { messages } from "../../../../constants/messages";
import UserModel from "../../../../models/user.model";
import { IRecommendationHistory } from "../../../../types/recommendation-history.types";
import sendResponse from "../../../../utils/commonFunctions/sendResponse";
import { StatusCodes } from "http-status-codes";
import RecommendationHistoryService from "../../../../services/recommendations/recommendation-history.service";
import recommendationHistoryModel from "../../../../models/recommendation-history.model";
import { resolveLanguage } from "../../../../utils/i18n/localizeFlowDefinition";
import { localizeRecommendationHistory } from "../../../../utils/i18n/localizeRecommendationHistory";
import { buildEmergencyAlert } from "../../../../utils/buildEmergencyAlert";
import { EUserCategory } from "../../../../types/user.types";
import { EAccessDenial } from "../../../../types/auth.types";
import { calculatePostpartumState } from "../../../../utils/functions/postpartumWeek";

// Fields a client is allowed to change through the generic update endpoint.
// Anything else in the payload is dropped to prevent arbitrary field injection.
const UPDATABLE_TOP_LEVEL_FIELDS = [
    "onboarding_data",
    "email",
    "mobile_number",
    "country_code",
    "preferred_language",
] as const;

// Contact fields that are login identifiers: editable only while unset (null),
// and must be unique across users.
const CONTACT_FIELDS = ["email", "mobile_number"] as const;

const userService = new UserService();
const recommendationHistoryService = new RecommendationHistoryService(recommendationHistoryModel);

export default class UserController {
    getUserbyAuthToken = async (req: Request, res: Response, next: NextFunction) => {
        try {
            await userService.getUserbyAuthToken(req, res);
        } catch (err) {
            console.log(err);
            next(err);
        }
    };

    updateFCMToken = async (req: Request, res: Response, next: NextFunction) => {
        try {
            if (!req.user) {
                throw new Error(messages.USER_FETCH_FAILED);
            }

            const { FCM_token } = req.body;

            // A physical device token must belong to exactly one user account.
            // Before assigning this token to the current user, evict it from
            // any other accounts that may still be holding it (e.g. a tester
            // who logged into multiple accounts on the same phone).
            if (FCM_token) {
                await UserModel.updateMany(
                    { FCM_token, _id: { $ne: req.user._id } },
                    { $unset: { FCM_token: 1 } },
                );
            }

            const updatedUser = await userService.findByIdAndUpdate({
                _id: req.user._id,
                payload: { FCM_token },
            });
            sendResponse({
                data: updatedUser,
                statusCode: StatusCodes.OK,
                success: true,
                message: messages.FCM_TOKEN_UPDATED_SUCCESS,
                response: res,
            });
        } catch (err) {
            console.log(err);
            next(err);
        }
    };

    /**
     * Irreversibly deletes the authenticated user's account and everything derived
     * from it. Required by Play's User Data policy, which wants an in-app deletion
     * path as well as the web one linked from the store listing.
     *
     * Scoped to `req.user._id` and nothing else — there is deliberately no id
     * parameter, so this endpoint cannot be pointed at another account.
     */
    deleteMyAccount = async (req: Request, res: Response, next: NextFunction) => {
        try {
            if (!req.user) {
                throw new Error(messages.USER_FETCH_FAILED);
            }

            const report = await accountDeletionService.deleteAccount(req.user._id);

            // The report names the collections cleared and the row counts. It is
            // returned so the client can log it and so a deletion can be evidenced
            // later; it contains counts only, never any of the deleted content.
            sendResponse({
                data: { deleted: report, retained: AccountDeletionService.RETAINED },
                statusCode: StatusCodes.OK,
                success: true,
                message: messages.ACCOUNT_DELETED_SUCCESS,
                response: res,
            });
        } catch (err) {
            console.log(err);
            next(err);
        }
    };

    sendOTPToPhone = async (req: Request, res: Response) => {
        await userService.sendOTPToPhone(req, res);
    };
    verifyOTP = async (req: Request, res: Response) => {
        await userService.verifyOTP(req, res);
    };

    googleAuth = async (req: Request, res: Response) => {
        await userService.googleAuth(req, res);
    };

    getCheckinScoreData = async (request: Request, response: Response, next: NextFunction) => {
        if (!request.user) {
            throw new Error(messages.USER_FETCH_FAILED);
        }
        const user = await UserModel.findById(request.user._id);
        const lang = resolveLanguage(request.query.lang, user?.preferred_language);

        try {
            const instance: IRecommendationHistory[] = await recommendationHistoryService.find({
                filter: { userId: user?._id },
                sort: { _id: -1 },
                limit: 1,
                selectedKeys: [
                    "individualRecommendations",
                    "zone",
                    "finalScore",
                    "week",
                    "tagline",
                    "translations",
                    "emergencyFlags",
                    "alertDismissedAt",
                    "flowDefId",
                ],
            });
            // Swap the frozen snapshot text to the requested language and strip
            // the internal `translations` blob before sending.
            const localized = instance.map((doc) => localizeRecommendationHistory(doc, lang));

            // Attach the dashboard alert for any red-flag answers in this check-in,
            // worded from the localized flow definition. The raw flags and the
            // dismissal timestamp are internal and are stripped, like `translations`.
            const withAlerts = await Promise.all(
                localized.map(async (doc, index) => {
                    const emergencyAlert = await buildEmergencyAlert(
                        { ...doc, _id: (instance[index] as any)?._id },
                        lang,
                    );
                    const { emergencyFlags, alertDismissedAt, flowDefId, ...rest } = doc as any;
                    return { ...rest, emergencyAlert };
                }),
            );

            sendResponse({
                data: withAlerts,
                statusCode: StatusCodes.OK,
                success: true,
                message: messages.RECOMMENDATION_RETRIEVED_SUCCESS,
                response,
            });
        } catch (err) {
            next(err);
        }
    };

    dismissEmergencyAlert = async (
        request: Request,
        response: Response,
        next: NextFunction,
    ) => {
        try {
            if (!request.user) {
                throw new Error(messages.USER_FETCH_FAILED);
            }

            const alertId = request.params.id as string;
            if (!alertId || !Types.ObjectId.isValid(alertId)) {
                return sendResponse({
                    data: null,
                    statusCode: StatusCodes.BAD_REQUEST,
                    success: false,
                    message: messages.EMERGENCY_ALERT_NOT_FOUND,
                    response,
                });
            }

            const dismissed = await recommendationHistoryService.dismissAlert(
                alertId,
                String(request.user._id),
            );

            if (!dismissed) {
                return sendResponse({
                    data: null,
                    statusCode: StatusCodes.NOT_FOUND,
                    success: false,
                    message: messages.EMERGENCY_ALERT_NOT_FOUND,
                    response,
                });
            }

            sendResponse({
                data: { alertDismissedAt: dismissed.alertDismissedAt },
                statusCode: StatusCodes.OK,
                success: true,
                message: messages.EMERGENCY_ALERT_DISMISSED_SUCCESS,
                response,
            });
        } catch (err) {
            next(err);
        }
    };

    updateUserData = async (req: Request, res: Response, next: NextFunction) => {
        try {
            if (!req.user) {
                throw new Error(messages.USER_FETCH_FAILED);
            }

            const currentUser = await UserModel.findById(req.user._id);
            if (!currentUser) {
                throw new Error(messages.USER_FETCH_FAILED);
            }

            // Whitelist: keep only fields a client may change.
            const payload: Record<string, any> = {};
            for (const field of UPDATABLE_TOP_LEVEL_FIELDS) {
                if (req.body[field] !== undefined) {
                    payload[field] = req.body[field];
                }
            }

            // Contact fields (email / mobile_number): allow only null -> value, and
            // reject values already used by another user.
            for (const field of CONTACT_FIELDS) {
                if (payload[field] === undefined || payload[field] === null) continue;

                if (currentUser[field]) {
                    sendResponse({
                        data: null,
                        statusCode: StatusCodes.CONFLICT,
                        success: false,
                        message: messages.CONTACT_ALREADY_SET,
                        response: res,
                    });
                    return;
                }

                const existing = await UserModel.findOne({
                    [field]: payload[field],
                    _id: { $ne: currentUser._id },
                });
                if (existing) {
                    sendResponse({
                        data: null,
                        statusCode: StatusCodes.CONFLICT,
                        success: false,
                        message: messages.CONTACT_ALREADY_IN_USE,
                        response: res,
                    });
                    return;
                }
            }

            // Delivery date: locked for postpartum (PP) users. When editable,
            // recompute pregnancy weeks + user_category so downstream data stays
            // consistent (mirrors chat-flow onboarding logic).
            const deliveryDate = payload.onboarding_data?.delivery_date;
            if (deliveryDate) {
                if (currentUser.user_category === EUserCategory.PP) {
                    sendResponse({
                        // Without a code this 403 is indistinguishable from an expired
                        // token and the app signs the user out of the whole product for
                        // trying to edit a locked field. EditProfile strips the field
                        // before sending, so this is not currently reachable — but that
                        // is a client-side guard standing in front of a server-side trap.
                        data: { code: EAccessDenial.DELIVERY_DATE_LOCKED },
                        statusCode: StatusCodes.FORBIDDEN,
                        success: false,
                        message: messages.DELIVERY_DATE_LOCKED,
                        response: res,
                    });
                    return;
                }

                const state = calculatePostpartumState(new Date(deliveryDate));

                // Set each subfield explicitly rather than assigning the whole object:
                // the due-day counters must move with the new delivery date, and the
                // helper's `mode` is not a schema field.
                payload.current_weekdays = {
                    weeks: state.weeks,
                    days: state.days,
                    previous_checkin_due_days: state.previousCheckinDueDays,
                    upcoming_checkin_due_days: state.upcomingCheckinDueDays,
                };
                payload.user_category =
                    state.mode === "pregnancy" ? EUserCategory.NP : EUserCategory.PP;
                payload.onboarding_data.is_not_pragnant_yet = false;
            }

            const updatedUser = await userService.findByIdAndPartialUpdate({
                _id: req.user._id,
                payload,
            });
            sendResponse({
                data: updatedUser,
                statusCode: StatusCodes.OK,
                success: true,
                message: messages.USER_UPDATED_SUCCESS,
                response: res,
            });
        } catch (err) {
            console.log(err);
            next(err);
        }
    };

}
