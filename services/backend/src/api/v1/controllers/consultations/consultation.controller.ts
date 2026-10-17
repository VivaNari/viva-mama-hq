import { NextFunction, Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { isValidObjectId } from "mongoose";
import { messages } from "../../../../constants/messages";
import { ConsultationReviewService } from "../../../../services/consultation-reviews/consultation-review.service";
import { ConsultationService } from "../../../../services/consultations/consultation.service";
import {
    CallbackRequestStatusEnum,
    EConsultationStage,
} from "../../../../types/consultation.types";
import sendResponse from "../../../../utils/commonFunctions/sendResponse";
import { resolveLanguage } from "../../../../utils/i18n/localizeFlowDefinition";
import { isEntitlementDenied, sendDenial } from "../../../../middlewares/entitlement.middleware";
import { InsufficientCreditsError } from "../../../../services/entitlements/credit.service";
import { ExpertBookingError } from "../../../../services/consultations/consultation.errors";
import {
    EDenialCode,
    EntitlementDeniedError,
} from "../../../../services/entitlements/entitlement.errors";
import { ECapability } from "../../../../services/entitlements/entitlement.config";
import { ESubscriptionTier } from "../../../../types/subscription.types";
import {
    JOIN_UNLOCK_LEAD_MINUTES,
    JOIN_WINDOW_GRACE_MINUTES,
    getSlotStartInstant,
    isSlotBookable,
    startOfIstDay,
} from "../../../../constants/consultation-slots";

export class ConsultationController {
    private consultationService: ConsultationService;
    private consultationReviewService: ConsultationReviewService;

    constructor() {
        this.consultationService = new ConsultationService();
        this.consultationReviewService = new ConsultationReviewService();
    }

    requestCallback = async (request: Request, response: Response, next: NextFunction) => {
        try {
            const { consultatorId, preferred_consultation_date, preferred_slot } = request.body;
            const userId = request.user._id;

            // Re-checked server-side: the app greys out slots that are too close, but a
            // stale screen or a hand-made request would otherwise book into the past.
            if (!isSlotBookable(new Date(preferred_consultation_date), preferred_slot)) {
                return sendResponse({
                    data: {},
                    statusCode: StatusCodes.BAD_REQUEST,
                    success: false,
                    message: messages.SLOT_NO_LONGER_BOOKABLE,
                    response,
                });
            }

            const result = await this.consultationService.requestCallback(
                userId,
                consultatorId,
                preferred_consultation_date,
                preferred_slot,
            );

            sendResponse({
                data: result,
                statusCode: StatusCodes.CREATED,
                success: true,
                message: messages.CONSULTATION_SAVED_SUCCESS,
                response,
            });
        } catch (err) {
            // Credit refusals are paywall responses, not faults.
            if (isEntitlementDenied(err)) return sendDenial(err, response);
            next(err);
        }
    };

    /**
     * POST /consultations/book-with-credit
     *
     * Books an expert using a subscription credit, bypassing Razorpay entirely.
     * Answers 402 NO_CREDITS for FREE and TRIAL, who have no bucket by construction and
     * are expected to use the pay-per-session route.
     */
    bookExpertWithCredit = async (request: Request, response: Response, next: NextFunction) => {
        try {
            const { expertId, preferred_consultation_date, preferred_slot } = request.body;
            const userId = request.user._id;

            if (!isSlotBookable(new Date(preferred_consultation_date), preferred_slot)) {
                return sendResponse({
                    data: {},
                    statusCode: StatusCodes.BAD_REQUEST,
                    success: false,
                    message: messages.SLOT_NO_LONGER_BOOKABLE,
                    response,
                });
            }

            const result = await this.consultationService.bookExpertWithCredit(
                userId,
                expertId,
                preferred_consultation_date,
                preferred_slot,
            );

            sendResponse({
                data: result,
                statusCode: StatusCodes.CREATED,
                success: true,
                message: messages.CONSULTATION_SAVED_SUCCESS,
                response,
            });
        } catch (err) {
            if (isEntitlementDenied(err)) return sendDenial(err, response);
            // Off-panel expert, or an id that names nobody. Neither is a paywall: the
            // subscription is fine, this expert just cannot be paid for with a credit.
            if (err instanceof ExpertBookingError) {
                return sendResponse({
                    data: { code: err.code },
                    statusCode: err.statusCode,
                    success: false,
                    message: err.message,
                    response,
                });
            }
            if (err instanceof InsufficientCreditsError) {
                return sendDenial(
                    new EntitlementDeniedError(EDenialCode.NO_CREDITS, {
                        capability: ECapability.CONSULTATION_EXPERT,
                        tier: ESubscriptionTier.PREMIUM,
                        upsell: ESubscriptionTier.PREMIUM,
                    }),
                    response,
                );
            }
            next(err);
        }
    };

    // markUnhandled / completeConsultation / confirmMeetingTime now live on
    // AdminController — they are coordinator actions and belong behind the admin guard.

    /**
     * GET /consultations/:consultationId/review-context
     *
     * Everything the rating screen needs to name the person being rated. The app is
     * pushed into that screen from a CONSULTATION_COMPLETED notification, whose payload
     * carries nothing but the id — without this the patient is asked to rate an
     * anonymous session.
     *
     * Scoped to the caller's own bookings: the id travels through a push payload, so it
     * must not be usable to read someone else's consultation.
     */
    getConsultationReviewContext = async (
        request: Request,
        response: Response,
        next: NextFunction,
    ) => {
        try {
            const consultationId = request.params.consultationId as string;

            if (!request.user) {
                throw new Error(messages.USER_FETCH_FAILED);
            }

            if (!consultationId || !isValidObjectId(consultationId)) {
                return sendResponse({
                    data: {},
                    statusCode: StatusCodes.NOT_FOUND,
                    success: false,
                    message: messages.CONSULTATION_NOT_FOUND,
                    response,
                });
            }

            const consultation: any = await this.consultationService.findById({
                _id: consultationId,
                populate: "consultatorId",
            });

            // A booking belonging to someone else is reported as missing rather than
            // forbidden — a 403 would confirm the id exists.
            if (!consultation || consultation.userId.toString() !== request.user._id.toString()) {
                return sendResponse({
                    data: {},
                    statusCode: StatusCodes.NOT_FOUND,
                    success: false,
                    message: messages.CONSULTATION_NOT_FOUND,
                    response,
                });
            }

            const lang = resolveLanguage(
                request.query.lang,
                (request.user as any)?.preferred_language,
            );

            const consultator = consultation.consultatorId;
            const consultatorObj =
                consultator && typeof consultator.toObject === "function"
                    ? consultator.toObject()
                    : consultator;

            const translated = consultatorObj?.translations?.[lang] ?? {};

            const existingReview = await this.consultationReviewService.findOne({
                filter: { consultationId: consultation._id },
            });

            sendResponse({
                data: {
                    consultationId: consultation._id,
                    consultationType: consultation.consultationType,
                    requestStatus: consultation.requestStatus,
                    // The date the call actually happened where it is known, otherwise
                    // the day it was booked for.
                    consultedAt:
                        consultation.meeting_confirmed_at ??
                        consultation.preferred_consultation_date,
                    // Only the display fields — a patient rating a session has no
                    // business receiving the consultant's phone number or email.
                    consultator: consultatorObj
                        ? {
                              _id: consultatorObj._id,
                              name: translated.name ?? consultatorObj.name,
                              // Experts carry `speciality`; care managers have none.
                              speciality:
                                  translated.speciality ?? consultatorObj.speciality ?? null,
                              qualification:
                                  translated.qualification ?? consultatorObj.qualification ?? null,
                              // Two collections, two field names, one thing to render.
                              photograph:
                                  consultatorObj.photograph ?? consultatorObj.imageUrl ?? null,
                          }
                        : null,
                    alreadyReviewed: Boolean(existingReview),
                    existingRating: existingReview?.rating ?? null,
                },
                statusCode: StatusCodes.OK,
                success: true,
                message: messages.CONSULTATION_FETCHED_SUCCESS,
                response,
            });
        } catch (err) {
            next(err);
        }
    };

    /**
     * GET /my-consultations
     *
     * The patient's whole booking history, each row tagged with the stage it falls in so
     * the app can split it into Upcoming / Ongoing / Past tabs without re-deriving any
     * of the time maths.
     *
     * Returns every booking in one response rather than paging per tab: a patient has a
     * handful of consultations, and one fetch makes switching tabs instant.
     */
    getMyConsultations = async (request: Request, response: Response, next: NextFunction) => {
        try {
            if (!request.user) {
                throw new Error(messages.USER_FETCH_FAILED);
            }

            const now = new Date();

            const instances = await this.consultationService.find({
                filter: { userId: request.user._id },
                // Newest first. The app re-sorts Upcoming ascending, where soonest-first
                // is what the patient wants to see.
                sort: { createdAt: -1 },
                populate: "consultatorId",
            });

            const lang = resolveLanguage(
                request.query.lang,
                (request.user as any)?.preferred_language,
            );

            // One query for every rating rather than one per row.
            const reviews = await this.consultationReviewService.find({
                filter: { consultationId: { $in: instances.map((inst: any) => inst._id) } },
            });
            const ratingByConsultation = new Map<string, number>(
                reviews.map((review: any) => [review.consultationId.toString(), review.rating]),
            );

            const history = instances.map((inst: any) => {
                const obj = typeof inst.toObject === "function" ? inst.toObject() : inst;
                const consultator = obj.consultatorId;
                const consultatorObj =
                    consultator && typeof consultator.toObject === "function"
                        ? consultator.toObject()
                        : consultator;
                const translated = consultatorObj?.translations?.[lang] ?? {};

                const confirmedAt: Date | null = obj.meeting_confirmed_at ?? null;
                const joinUnlocksAt = confirmedAt
                    ? new Date(confirmedAt.getTime() - JOIN_UNLOCK_LEAD_MINUTES * 60_000)
                    : null;
                const joinClosesAt = confirmedAt
                    ? new Date(confirmedAt.getTime() + JOIN_WINDOW_GRACE_MINUTES * 60_000)
                    : null;

                // When the call is taken to have started.
                //
                // The confirmed time where the coordinator has set one. Otherwise the
                // opening of the slot the patient asked for — a booking still awaiting a
                // time has to age out of Upcoming too, and the stored date is IST
                // midnight, which would call a 9 AM booking "in progress" from the small
                // hours. Bookings that predate slots keep the bare date; there is nothing
                // finer recorded on them.
                const startsAt: Date =
                    confirmedAt ??
                    (obj.preferred_slot
                        ? getSlotStartInstant(obj.preferred_consultation_date, obj.preferred_slot)
                        : obj.preferred_consultation_date);

                const isSettled =
                    obj.requestStatus === CallbackRequestStatusEnum.COMPLETED ||
                    obj.requestStatus === CallbackRequestStatusEnum.UNHANDLED;

                const stage = isSettled
                    ? EConsultationStage.PAST
                    : startsAt <= now
                      ? EConsultationStage.ONGOING
                      : EConsultationStage.UPCOMING;

                return {
                    _id: obj._id,
                    consultationType: obj.consultationType,
                    requestStatus: obj.requestStatus,
                    stage,
                    startsAt,
                    preferred_consultation_date: obj.preferred_consultation_date,
                    preferred_slot: obj.preferred_slot,
                    meeting_confirmed_at: obj.meeting_confirmed_at,
                    meeting_link: obj.meeting_link,
                    paymentMode: obj.paymentMode,
                    createdAt: obj.createdAt,
                    joinUnlocksAt,
                    canJoinNow: Boolean(
                        obj.meeting_link &&
                        joinUnlocksAt &&
                        joinClosesAt &&
                        now >= joinUnlocksAt &&
                        now <= joinClosesAt,
                    ),
                    // Display fields only — a booking list is no reason to hand a patient
                    // the consultant's phone number or the coordinator's routing number.
                    consultator: consultatorObj
                        ? {
                              _id: consultatorObj._id,
                              name: translated.name ?? consultatorObj.name,
                              speciality:
                                  translated.speciality ?? consultatorObj.speciality ?? null,
                              // Experts store `photograph`, care managers `imageUrl`.
                              photograph:
                                  consultatorObj.photograph ?? consultatorObj.imageUrl ?? null,
                          }
                        : null,
                    // Drives the "Rate this consultation" prompt on a finished call, and
                    // shows the score back once one has been left.
                    rating: ratingByConsultation.get(obj._id.toString()) ?? null,
                };
            });

            sendResponse({
                data: history,
                statusCode: StatusCodes.OK,
                success: true,
                message: messages.CONSULTATIONS_FETCHED_SUCCESS,
                response,
            });
        } catch (err) {
            next(err);
        }
    };

    getPendingConsultations = async (request: Request, response: Response, next: NextFunction) => {
        try {
            if (!request.user) {
                throw new Error(messages.USER_FETCH_FAILED);
            }

            const now = new Date();
            // A booking stays on the dashboard until its date has passed — or, once a
            // time is confirmed, until the call window closes. Without the second clause
            // a consultation confirmed for 10:30 AM would vanish from the banner at
            // midnight that morning, taking the Join button with it.
            const graceCutoff = new Date(now.getTime() - JOIN_WINDOW_GRACE_MINUTES * 60_000);
            // IST midnight, not the server's. See startOfIstDay.
            const startOfToday = startOfIstDay(now);

            const instances = await this.consultationService.find({
                filter: {
                    userId: request.user._id,
                    requestStatus: CallbackRequestStatusEnum.PENDING,
                    $or: [
                        { preferred_consultation_date: { $gte: startOfToday } },
                        { meeting_confirmed_at: { $gte: graceCutoff } },
                    ],
                },
                sort: { createdAt: -1 },
                populate: "consultatorId",
            });

            // Localize the consultator's name (care manager or expert) and strip
            // the internal `translations` blob before sending.
            const lang = resolveLanguage(
                request.query.lang,
                (request.user as any)?.preferred_language,
            );
            const localized = instances.map((inst: any) => {
                const obj = typeof inst.toObject === "function" ? inst.toObject() : inst;
                const consultator = obj.consultatorId;
                if (consultator && typeof consultator === "object") {
                    const localizedName = consultator.translations?.[lang]?.name;
                    if (localizedName) consultator.name = localizedName;
                    delete consultator.translations;
                    // The coordinator's routing number is internal. It rides along on the
                    // populated document and must not reach a patient's device.
                    delete consultator.contactWhatsappNumber;
                    delete consultator.phoneNumber;
                    delete consultator.email;
                }

                // Unlock maths is done here rather than on the client so the app never
                // has to reason about timezones — it just compares two instants.
                const confirmedAt: Date | null = obj.meeting_confirmed_at ?? null;
                const joinUnlocksAt = confirmedAt
                    ? new Date(confirmedAt.getTime() - JOIN_UNLOCK_LEAD_MINUTES * 60_000)
                    : null;
                const joinClosesAt = confirmedAt
                    ? new Date(confirmedAt.getTime() + JOIN_WINDOW_GRACE_MINUTES * 60_000)
                    : null;

                return {
                    ...obj,
                    joinUnlocksAt,
                    canJoinNow: Boolean(
                        obj.meeting_link &&
                        joinUnlocksAt &&
                        joinClosesAt &&
                        now >= joinUnlocksAt &&
                        now <= joinClosesAt,
                    ),
                };
            });

            sendResponse({
                data: localized,
                statusCode: StatusCodes.OK,
                success: true,
                message: messages.CONSULTATION_FETCHED_SUCCESS,
                response,
            });
        } catch (err) {
            next(err);
        }
    };
}
