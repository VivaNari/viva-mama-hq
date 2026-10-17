import { Schema } from "mongoose";
import { messages, notificationMessages } from "../../constants/messages";
import consultationModel from "../../models/consultation.model";
import expertModel from "../../models/expert.model";
import { ICareManager } from "../../types/care-manager.types";
import { IUser } from "../../types/user.types";
import {
    CallbackRequestStatusEnum,
    ConsultationTypeEnum,
    IConsultationRequest,
    IValidateRequestCallBackParams,
    IValidateRequestCallBackParamsError,
} from "../../types/consultation.types";
import { sendPushNotification } from "../../utils/sendPushNotification";
import { ExpertBookingError, OutsideSlotConfirmationRequiredError } from "./consultation.errors";
import { isInPersonOnlyExpert } from "../expert/expert.rules";
import BaseService from "../base.service";
import { CareManagerService } from "../care-manager/care-manager.service";
import {
    EConsultationBookingTemplate,
    sendWhatsappMessageForConsultationBooking,
} from "../getgabs/sendWhatsappMessageForConsultationBooking";
import { meetSpaceService } from "../google-meet/meet-space.service";
import { expert as expertConstants } from "../../constants/expert";
import {
    EPreferredSlot,
    PREFERRED_SLOT_LABELS,
    isTimeWithinSlot,
} from "../../constants/consultation-slots";
import { formatIstDate, formatIstDateTime } from "../../utils/commonFunctions/formatIst";
import UserService from "../users/user.service";
import { creditService } from "../entitlements/credit.service";
import { entitlementService } from "../entitlements/entitlement.service";
import { ECapability } from "../entitlements/entitlement.config";
import { EDenialCode, EntitlementDeniedError } from "../entitlements/entitlement.errors";
import { subscriptionService } from "../subscription/subscription.service";
import {
    EConsultationPaymentMode,
    ECreditType,
    ESubscriptionTier,
} from "../../types/subscription.types";

export class ConsultationService extends BaseService<IConsultationRequest> {
    private userService: UserService;
    private careManagerService: CareManagerService;

    constructor() {
        super(consultationModel);
        this.userService = new UserService();
        this.careManagerService = new CareManagerService();
    }

    /**
     * The subscription a credit would be drawn from, and when it expires.
     *
     * Returns null when the user has no live subscription — which is every FREE and
     * TRIAL user, since credits are granted only on a paid activation.
     */
    private async getCreditContext(
        userId: string,
    ): Promise<{ subscriptionId: Schema.Types.ObjectId; expiresAt: Date } | null> {
        const subscription = await subscriptionService.getCurrent(userId);
        if (!subscription?.currentPeriodEnd) return null;

        return {
            subscriptionId: subscription._id,
            expiresAt: subscription.currentPeriodEnd,
        };
    }

    /**
     * Spend a credit against a consultation that has just been created.
     *
     * The consultation must exist first: its id backs the unique CONSUME index, which
     * is what makes a double-tapped "Book" spend one credit rather than two. If the
     * spend fails — no balance, or a race lost — the consultation is removed again, so
     * a booking never exists without the credit that paid for it.
     */
    private async spendCreditOrRollback(params: {
        userId: string;
        consultationId: Schema.Types.ObjectId;
        type: ECreditType;
        subscriptionId: Schema.Types.ObjectId;
        expiresAt: Date;
    }): Promise<Schema.Types.ObjectId> {
        try {
            const ledgerRow = await creditService.consume({
                userId: params.userId,
                subscriptionId: params.subscriptionId,
                type: params.type,
                consultationId: params.consultationId,
                expiresAt: params.expiresAt,
            });

            await consultationModel.updateOne(
                { _id: params.consultationId },
                {
                    $set: {
                        paymentMode: EConsultationPaymentMode.CREDIT,
                        credit_ledger_id: ledgerRow._id,
                    },
                },
            );

            return ledgerRow._id;
        } catch (error) {
            await consultationModel.deleteOne({ _id: params.consultationId });
            throw error;
        }
    }

    /**
     * Everything that happens after a booking is durable: mint the Meet room, then tell
     * the coordinator about it.
     *
     * This is the single convergence point for all three booking routes — expert paid,
     * expert credit, care-manager credit. It exists because the paid and credit paths had
     * already drifted once: only the paid one sent a WhatsApp, so every premium user
     * booking with a credit went unnoticed by the coordinator.
     *
     * Never throws. By the time it runs, money or a credit has already changed hands, so
     * neither a Meet outage nor a GetGabs outage may unwind the booking.
     */
    private finalizeBooking = async (params: {
        consultation: IConsultationRequest & { _id: Schema.Types.ObjectId; createdAt?: Date };
        consultantName: string;
        contactWhatsappNumber: string;
        user: IUser;
        template: EConsultationBookingTemplate;
        payment: string;
    }) => {
        const { consultation, consultantName, contactWhatsappNumber, user, template, payment } =
            params;
        const consultationId = (consultation as any)._id.toString();

        // Generated before the notification, not after — the link is the most useful
        // thing in the message, and a room with no scheduled time costs nothing if the
        // booking is later cancelled.
        //
        // meetSpaceService swallows its own failures and answers null, so this catch is
        // defence in depth: the booking is already paid for, and neither a broken
        // contract upstream nor a failed write here may be allowed to unwind it.
        let space: Awaited<ReturnType<typeof meetSpaceService.createMeetSpace>> = null;
        try {
            space = await meetSpaceService.createMeetSpace();
            if (space) {
                await consultationModel.updateOne(
                    { _id: (consultation as any)._id },
                    {
                        $set: {
                            meeting_link: space.meetingUri,
                            meeting_space_id: space.spaceName,
                        },
                    },
                );
            }
        } catch (err) {
            space = null;
            console.error("Meet room generation failed (non-fatal)", err);
        }

        try {
            await sendWhatsappMessageForConsultationBooking(template, {
                to: contactWhatsappNumber,
                // Users have no top-level name — the one they gave during onboarding is
                // the only one we hold. Falls through to the contact so the coordinator
                // always has something to address them by.
                patientName: user.onboarding_data?.preferred_name || user.mobile_number || "",
                patientContact: user.mobile_number || user.email || "",
                consultantName,
                bookedOn: formatIstDateTime(new Date()),
                consultationDate: formatIstDate(consultation.preferred_consultation_date),
                preferredSlot: consultation.preferred_slot
                    ? PREFERRED_SLOT_LABELS[consultation.preferred_slot]
                    : "Not specified",
                payment,
                // The coordinator needs to know a link is coming rather than assume the
                // message is malformed.
                joinLink: space?.meetingUri || "Link to follow",
                bookingRef: consultationId,
            });
        } catch (err) {
            console.error("WhatsApp notification failed (non-fatal)", err);
        }

        return space;
    };

    /**
     * finalizeBooking for the pay-per-session route, which lives in its own service
     * because it is entangled with Razorpay. Exposed as a named wrapper rather than
     * making finalizeBooking public, so the payment service cannot accidentally pass a
     * credit-shaped payment description.
     *
     * Serves both consultant kinds — experts have always paid per session, and
     * counsellors now do too once a user has no credit left.
     */
    finalizeBookingForPaidConsultation = async (params: {
        consultation: IConsultationRequest & { _id: Schema.Types.ObjectId };
        consultantName: string;
        contactWhatsappNumber: string | null;
        consultationType: ConsultationTypeEnum;
        user: IUser;
        amountPaise: number;
    }) => {
        return this.finalizeBooking({
            consultation: params.consultation as any,
            consultantName: params.consultantName,
            contactWhatsappNumber:
                params.contactWhatsappNumber || expertConstants.whatsappMessageReceiver,
            user: params.user,
            template:
                params.consultationType === ConsultationTypeEnum.CARE_MANAGER
                    ? EConsultationBookingTemplate.CARE_MANAGER
                    : EConsultationBookingTemplate.EXPERT,
            // Order amounts are stored in paise, the unit Razorpay charges in.
            payment: `Paid ₹${Math.round(params.amountPaise / 100)}`,
        });
    };

    /** How the settlement reads in the coordinator's WhatsApp message. */
    private describeCreditPayment = async (userId: string, type: ECreditType): Promise<string> => {
        const remaining = await creditService.getBalance(userId, type);
        return `Credit (1 used, ${remaining} left)`;
    };

    /**
     * Book an expert consultation using a credit, skipping the payment gateway.
     *
     * The paid flow (book-consultation-payment.service.ts) stays as-is and serves FREE
     * and TRIAL users, plus premium users who have run out of credits.
     */
    bookExpertWithCredit = async (
        userId: string,
        expertId: string,
        preferred_consultation_date: Date,
        preferred_slot: EPreferredSlot,
    ) => {
        const tier = await entitlementService.assertCapability(
            userId,
            ECapability.CONSULTATION_EXPERT,
        );

        // Resolved before anything is written. A credit is priced against the in-house
        // session fee, so spending one on an off-panel specialist charging several times
        // that costs more to fulfil than the plan brought in. Checking it here rather
        // than after the spend means there is no consultation and no ledger row to undo.
        const expertInstance = await expertModel.findById(expertId);
        if (!expertInstance) {
            throw new ExpertBookingError("EXPERT_NOT_FOUND");
        }
        // Checked before empanelment: a referring doctor who sees her patients at her own
        // clinic takes no in-app bookings at all, so spending a credit on her would buy a
        // session nobody arranged. This holds even if she is flagged empanelled, which is
        // exactly the combination the empanelment check alone would let through.
        if (isInPersonOnlyExpert(expertInstance)) {
            throw new ExpertBookingError("EXPERT_IN_PERSON_ONLY");
        }
        if (!expertInstance.is_empanelled_expert) {
            throw new ExpertBookingError("EXPERT_NOT_EMPANELLED");
        }

        const context = await this.getCreditContext(userId);
        if (!context) {
            // FREE and TRIAL have no credit bucket by construction — they are expected
            // to use the pay-per-session route instead.
            throw new EntitlementDeniedError(EDenialCode.NO_CREDITS, {
                capability: ECapability.CONSULTATION_EXPERT,
                tier,
                upsell: ESubscriptionTier.PREMIUM,
            });
        }

        const consultation = await this.create({
            userId: userId as unknown as Schema.Types.ObjectId,
            consultatorId: expertId as unknown as Schema.Types.ObjectId,
            consultationType: ConsultationTypeEnum.EXPERT,
            requestStatus: CallbackRequestStatusEnum.PENDING,
            preferred_consultation_date,
            preferred_slot,
            meeting_link: null,
            meeting_space_id: null,
            meeting_confirmed_at: null,
            // Nothing to remind about until a time is confirmed.
            reminders_sent: [],
            paymentMode: null,
            credit_ledger_id: null,
        } as IConsultationRequest);

        await this.spendCreditOrRollback({
            userId,
            consultationId: (consultation as any)._id,
            type: ECreditType.EXPERT,
            subscriptionId: context.subscriptionId,
            expiresAt: context.expiresAt,
        });

        // `expertInstance` was already resolved above for the empanelment check; the
        // notification needs its name and routing number, so it is reused rather than
        // re-queried.
        const userInstance = await this.userService.findById({ _id: userId });

        if (userInstance) {
            await this.finalizeBooking({
                consultation: consultation as any,
                consultantName: expertInstance.name,
                contactWhatsappNumber:
                    expertInstance.contactWhatsappNumber || expertConstants.whatsappMessageReceiver,
                user: userInstance,
                template: EConsultationBookingTemplate.EXPERT,
                payment: await this.describeCreditPayment(userId, ECreditType.EXPERT),
            });
        }

        // Re-read so the caller sees the meeting_link finalizeBooking just wrote.
        return (await this.findById({ _id: (consultation as any)._id.toString() })) ?? consultation;
    };

    validateRequestCallBackParams = async (
        userId: string,
        consultatorId: string,
    ): Promise<IValidateRequestCallBackParams | IValidateRequestCallBackParamsError> => {
        const userInstance = await this.userService.findById({
            _id: userId,
        });

        if (!userInstance) {
            return {
                isValid: false,
                errorMessage: messages.USER_NOT_FOUND,
            };
        }

        const consultatorInstance = await this.careManagerService.findById({
            _id: consultatorId,
        });

        if (!consultatorInstance) {
            return {
                isValid: false,
                errorMessage: messages.CARE_MANAGER_NOT_FOUND,
            };
        }

        return {
            isValid: true,
            userInstance,
            consultatorInstance,
        };
    };

    requestCallback = async (
        userId: string,
        consultatorId: string,
        preferred_consultation_date: Date,
        preferred_slot: EPreferredSlot,
    ) => {
        const result = await this.validateRequestCallBackParams(userId, consultatorId);

        if (!result.isValid) {
            return {
                isValid: false,
                errorMessage: result.errorMessage,
            };
        }

        const { userInstance, consultatorInstance } = result;

        // Care-manager callbacks used to be free and unlimited for everyone. They are
        // now a premium credit: LOCKED below PREMIUM, and drawn from the CARE_MANAGER
        // bucket above it. This is the one route where a non-paying user loses
        // something they previously had.
        const tier = await entitlementService.assertCapability(
            userId,
            ECapability.CONSULTATION_CARE_MANAGER,
        );

        const context = await this.getCreditContext(userId);
        if (!context) {
            throw new EntitlementDeniedError(EDenialCode.NO_CREDITS, {
                capability: ECapability.CONSULTATION_CARE_MANAGER,
                tier,
                upsell: ESubscriptionTier.PREMIUM,
            });
        }

        const consultationPayload: IConsultationRequest = {
            userId: userId as unknown as Schema.Types.ObjectId,
            consultatorId: consultatorId as unknown as Schema.Types.ObjectId,
            consultationType: ConsultationTypeEnum.CARE_MANAGER,
            requestStatus: CallbackRequestStatusEnum.PENDING,
            preferred_consultation_date,
            preferred_slot,
            // Written by finalizeBooking once the room exists.
            meeting_link: null,
            meeting_space_id: null,
            meeting_confirmed_at: null,
            // Nothing to remind about until a time is confirmed.
            reminders_sent: [],
            // Filled in by spendCreditOrRollback once the credit is actually spent.
            paymentMode: null,
            credit_ledger_id: null,
        };

        const consultationInstance: IConsultationRequest = await this.create(consultationPayload);

        await this.spendCreditOrRollback({
            userId,
            consultationId: (consultationInstance as any)._id,
            type: ECreditType.CARE_MANAGER,
            subscriptionId: context.subscriptionId,
            expiresAt: context.expiresAt,
        });

        const careManager = consultatorInstance as ICareManager;
        await this.finalizeBooking({
            consultation: consultationInstance as any,
            consultantName: careManager.name,
            // Routed to the coordinator like experts are, so one person owns confirming
            // times across both. Pointing a care manager at their own number later is a
            // DB edit, hence the field rather than the constant.
            contactWhatsappNumber:
                careManager.contactWhatsappNumber || expertConstants.whatsappMessageReceiver,
            user: userInstance,
            template: EConsultationBookingTemplate.CARE_MANAGER,
            payment: await this.describeCreditPayment(userId, ECreditType.CARE_MANAGER),
        });

        // Re-read so the caller sees the meeting_link finalizeBooking just wrote.
        return (
            (await this.findById({ _id: (consultationInstance as any)._id.toString() })) ??
            consultationInstance
        );
    };

    /**
     * Record the exact 30-minute start the coordinator agreed with the consultant.
     *
     * This is the one manual step in the loop: the coordinator settles the time over
     * WhatsApp and reports it back, and setting it here is what unlocks the patient's
     * Join button five minutes ahead of the call.
     *
     * The slot the patient picked is a preference, not a constraint: the coordinator may
     * confirm any time. The window is still checked, but only to ask once — a time typed
     * as 10:30 but stored without a timezone lands at 4:00 PM IST, and nobody would
     * notice until the patient missed the call.
     */
    confirmMeetingTime = async (
        consultationId: string,
        confirmedAt: Date,
        acknowledgeOutsideSlot = false,
    ) => {
        const consultation = await consultationModel.findById(consultationId);
        if (!consultation) {
            throw new Error(messages.CONSULTATION_NOT_FOUND);
        }

        const preferredSlotLabel = consultation.preferred_slot
            ? PREFERRED_SLOT_LABELS[consultation.preferred_slot]
            : null;

        const outsidePreferredSlot = Boolean(
            consultation.preferred_slot &&
            !isTimeWithinSlot(
                confirmedAt,
                consultation.preferred_consultation_date,
                consultation.preferred_slot,
            ),
        );

        // Soft guard: nothing is written and no push goes out until the caller confirms
        // the mismatch is intentional. Deliberately before the update so a mistyped time
        // never reaches the patient, and deliberately not a hard refusal so a genuinely
        // rescheduled call still goes through on the second attempt.
        if (outsidePreferredSlot && !acknowledgeOutsideSlot) {
            throw new OutsideSlotConfirmationRequiredError(preferredSlotLabel);
        }

        const updated = await consultationModel.findByIdAndUpdate(
            consultationId,
            {
                $set: {
                    meeting_confirmed_at: confirmedAt,
                    // Re-arm both pre-call reminders against the new time. A call moved
                    // from 3pm to 6pm has already fired its 1-hour reminder for a time
                    // that no longer exists; without this reset the patient would be
                    // reminded about the old slot and never about the new one.
                    reminders_sent: [],
                },
            },
            { new: true },
        );

        const userInstance = await this.userService.findById({
            _id: consultation.userId.toString(),
        });

        if (userInstance?.FCM_token) {
            // Best-effort: the banner already reflects the change on next fetch, so a
            // failed push must not fail the confirmation.
            try {
                await sendPushNotification({
                    token: userInstance.FCM_token,
                    title: notificationMessages.CONSULTATION_TIME_CONFIRMED_TITLE,
                    body: notificationMessages.CONSULTATION_TIME_CONFIRMED_BODY(
                        formatIstDateTime(confirmedAt),
                    ),
                    data: {
                        type: "CONSULTATION_TIME_CONFIRMED",
                        consultationId,
                    },
                });
            } catch (err) {
                console.error("Confirm-time push failed (non-fatal)", err);
            }
        }

        // The flag rides along so the panel can show the confirmation it settled on as
        // an out-of-window one, rather than having to re-derive the slot bounds itself.
        return {
            ...(updated?.toObject() ?? {}),
            outside_preferred_slot: outsidePreferredSlot,
            preferred_slot_label: preferredSlotLabel,
        };
    };

    /**
     * Mark a consultation COMPLETED and tell the patient.
     *
     * Takes only the consultation id: the caller is an administrator, not the patient,
     * so the notification target has to come off the booking itself rather than from
     * whoever is holding the token.
     */
    completeConsultation = async (consultationId: string) => {
        const consultation = await this.findById({ _id: consultationId });

        if (!consultation) {
            throw new Error(messages.CONSULTATION_NOT_FOUND);
        }

        const userInstance = await this.userService.findById({
            _id: consultation.userId.toString(),
        });

        const updatedConsultationInstance = await this.findByIdAndUpdate({
            _id: consultationId,
            payload: {
                requestStatus: CallbackRequestStatusEnum.COMPLETED,
            },
        });

        if (userInstance?.FCM_token) {
            // Best-effort, same as confirmMeetingTime: the status is already written,
            // so a dead device token must not fail the administrator's action.
            try {
                await sendPushNotification({
                    token: userInstance.FCM_token,
                    body: notificationMessages.NOTIFICATION_COMPLETE_NOTIFICATION_BODY,
                    data: {
                        type: "CONSULTATION_COMPLETED",
                        consultationId: consultationId,
                    },
                    title: notificationMessages.NOTIFICATION_COMPLETE_NOTIFICATION_TITLE,
                });
            } catch (err) {
                console.error("Complete-consultation push failed (non-fatal)", err);
            }
        }

        return updatedConsultationInstance;
    };

    /**
     * Mark a consultation UNHANDLED and give the credit back.
     *
     * A credit paid for a consultation that never happened has to return, and it
     * returns as a new REFUND row rather than by deleting the CONSUME — the ledger is
     * append-only so the whole sequence stays auditable.
     *
     * Idempotent: `credit_ledger_id` is cleared as part of the same update, so a second
     * call finds nothing to refund and cannot mint a credit out of nothing.
     */
    markUnhandled = async (consultationId: string) => {
        const consultation = await consultationModel.findById(consultationId);
        if (!consultation) {
            throw new Error(messages.CONSULTATION_NOT_FOUND);
        }

        const wasPaidWithCredit =
            consultation.paymentMode === EConsultationPaymentMode.CREDIT &&
            consultation.credit_ledger_id != null;

        const updated = await consultationModel.findOneAndUpdate(
            // Guarded on the ledger id still being present: two concurrent calls cannot
            // both pass this filter, so only one refund is ever issued.
            wasPaidWithCredit
                ? { _id: consultationId, credit_ledger_id: { $ne: null } }
                : { _id: consultationId },
            {
                $set: {
                    requestStatus: CallbackRequestStatusEnum.UNHANDLED,
                    ...(wasPaidWithCredit ? { credit_ledger_id: null } : {}),
                },
            },
            { new: true },
        );

        if (!updated || !wasPaidWithCredit) {
            return updated ?? consultation;
        }

        const subscription = await subscriptionService.getCurrent(consultation.userId);
        // Refund into the subscription that is live now. If the term has already ended
        // there is nothing meaningful to credit back to — the credits expired with it.
        if (subscription?.currentPeriodEnd) {
            await creditService.refund({
                userId: consultation.userId,
                subscriptionId: subscription._id,
                type:
                    consultation.consultationType === ConsultationTypeEnum.CARE_MANAGER
                        ? ECreditType.CARE_MANAGER
                        : ECreditType.EXPERT,
                consultationId: consultation._id,
                expiresAt: subscription.currentPeriodEnd,
            });
        }

        return updated;
    };

    /**
     * Paginated listing for the admin panel.
     *
     * Deliberately not built on `getPendingConsultations`: that one is scoped to a
     * single patient and strips the consultant's contact details before responding,
     * which is exactly the information a coordinator needs in order to arrange the
     * call. Nothing here is patient-facing.
     */
    listForAdmin = async ({
        page = 1,
        limit = 10,
        status,
        consultationType,
        search,
    }: {
        page?: number;
        limit?: number;
        status?: CallbackRequestStatusEnum;
        consultationType?: ConsultationTypeEnum;
        search?: string;
        // Annotated explicitly: the populated `.lean()` result is a structural type
        // too large for tsc to serialize (TS7056).
    }): Promise<{
        items: Record<string, unknown>[];
        total: number;
        page: number;
        limit: number;
    }> => {
        const safeLimit = Math.min(Math.max(limit, 1), 100);
        const safePage = Math.max(page, 1);
        const skip = (safePage - 1) * safeLimit;

        const filter: Record<string, unknown> = {};

        if (status) {
            filter.requestStatus = status;
        }
        if (consultationType) {
            filter.consultationType = consultationType;
        }

        // `consultations` carries no denormalized patient name, so a search has to be
        // resolved to user ids first. An empty result set short-circuits to zero rows
        // rather than degrading into an unfiltered listing.
        if (search?.trim()) {
            const escaped = search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            const rx = new RegExp(escaped, "i");
            const matchedUsers = await this.userService.find({
                filter: {
                    $or: [
                        { mobile_number: rx },
                        { email: rx },
                        { "onboarding_data.preferred_name": rx },
                    ],
                },
                selectedKeys: ["_id"],
            });
            filter.userId = { $in: matchedUsers.map((user) => user._id) };
        }

        const [items, total] = await Promise.all([
            consultationModel
                .find(filter)
                // Nulls sort first in Mongo, so unconfirmed bookings — the ones that
                // still need a coordinator — surface ahead of settled ones.
                .sort({ meeting_confirmed_at: 1, preferred_consultation_date: 1 })
                .skip(skip)
                .limit(safeLimit)
                .populate(
                    "userId",
                    "user_id email mobile_number country_code onboarding_data.preferred_name profile_picture",
                )
                .populate("consultatorId")
                .lean(),
            consultationModel.countDocuments(filter),
        ]);

        return {
            items: items.map((item) => ({
                ...item,
                // Resolved here so the admin client never re-implements slot text.
                preferred_slot_label: item.preferred_slot
                    ? PREFERRED_SLOT_LABELS[item.preferred_slot as EPreferredSlot]
                    : null,
            })),
            total,
            page: safePage,
            limit: safeLimit,
        };
    };
}
