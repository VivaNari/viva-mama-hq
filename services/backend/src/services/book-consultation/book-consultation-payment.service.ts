import crypto from "crypto";
import { Response } from "express";
import { StatusCodes } from "http-status-codes";
import Razorpay from "razorpay";
import env from "../../config/env";
import { messages } from "../../constants/messages";

import { isSlotBookable } from "../../constants/consultation-slots";
import bookConsultationOrderModel from "../../models/book-consultation.model";
import careManagerModel from "../../models/care-manager.model";
import expertModel from "../../models/expert.model";
import UserModel from "../../models/user.model";
import {
    IBookConsultationOrder,
    ICreateIBookConsultationOrderPayload,
} from "../../types/book-consultation.types";
import { ConsultationTypeEnum } from "../../types/consultation.types";
import sendResponse from "../../utils/commonFunctions/sendResponse";
import BaseService from "../base.service";
import { ConsultationService } from "../consultations/consultation.service";
import { isInPersonOnlyExpert } from "../expert/expert.rules";
import { EConsultationPaymentMode } from "../../types/subscription.types";

class BookConsultationPaymentService extends BaseService<IBookConsultationOrder> {
    private razorpayInstance;
    private callbackRequestService: ConsultationService;
    constructor() {
        super(bookConsultationOrderModel);
        this.razorpayInstance = new Razorpay({
            key_id: env.RAZORPAY_API_KEY as string,
            key_secret: env.RAZORPAY_SECRET_KEY as string,
        });
        this.callbackRequestService = new ConsultationService();
    }

    public async createOrder({
        consultantId,
        consultationType,
        date,
        preferredSlot,
        userId,
        response,
    }: ICreateIBookConsultationOrderPayload) {
        // create the order in razorpay and send the order id to the client to proceed with the payment
        try {
            // Checked here rather than on verify: refusing before the payment sheet opens
            // costs the user nothing, whereas refusing afterwards would mean refunding.
            if (!isSlotBookable(new Date(date), preferredSlot)) {
                return sendResponse({
                    data: {},
                    statusCode: StatusCodes.BAD_REQUEST,
                    success: false,
                    message: messages.SLOT_NO_LONGER_BOOKABLE,
                    response,
                });
            }

            /**
             * The fee comes from the consultant's document, never from the request.
             *
             * `amount` used to be taken straight off the body, which let a client book a
             * ₹700 gynaecologist for ₹1 — and that hole undoes the whole point of
             * restricting credits to the panel, since underpaying is simply the cheaper
             * route to the same consultation. Resolved server-side here for the same
             * reason subscriptionService.createCheckout resolves price from planCode.
             *
             * The request may still carry `amount`; it is ignored rather than rejected,
             * so app builds that predate this keep working.
             */
            const consultant =
                consultationType === ConsultationTypeEnum.CARE_MANAGER
                    ? await careManagerModel.findById(consultantId).select("remuneration")
                    : await expertModel.findById(consultantId).select("remuneration");

            if (!consultant) {
                return sendResponse({
                    data: {},
                    statusCode: StatusCodes.NOT_FOUND,
                    success: false,
                    message: messages.CONSULTANT_NOT_FOUND,
                    response,
                });
            }

            // An expert on a zero fee is not a mis-seeded document — she is a referring
            // doctor who consults at her own clinic, and the app never offers a booking
            // for her. Named here so the client gets "meet her in person" instead of the
            // "fee is not set up yet" that the generic guard below would report.
            if (
                consultationType !== ConsultationTypeEnum.CARE_MANAGER &&
                isInPersonOnlyExpert(consultant)
            ) {
                return sendResponse({
                    data: {},
                    statusCode: StatusCodes.CONFLICT,
                    success: false,
                    message: messages.EXPERT_IN_PERSON_ONLY,
                    response,
                });
            }

            const amountPaise = Math.round(Number(consultant.remuneration) * 100);

            // The fee is the server's responsibility now, so the server has to stand
            // behind it. A counsellor document that predates the remuneration field and
            // missed the backfill would otherwise send NaN to Razorpay and surface as an
            // unexplained payment failure.
            if (!Number.isFinite(amountPaise) || amountPaise <= 0) {
                return sendResponse({
                    data: {},
                    statusCode: StatusCodes.CONFLICT,
                    success: false,
                    message: messages.CONSULTANT_FEE_UNAVAILABLE,
                    response,
                });
            }

            const options = {
                amount: amountPaise, // razorpay accepts paisa
                currency: "INR",
                receipt: "receipt_" + Date.now(),
            };

            const order = await this.razorpayInstance.orders.create(options);

            const data = await bookConsultationOrderModel.create({
                order_id: order.id,
                receipt: order.receipt,
                user_id: userId,
                consultant_id: consultantId,
                consultation_type: consultationType,
                amount: amountPaise,
                currency: "INR",
                status: "created",
                preferred_consultation_date: date,
                preferred_slot: preferredSlot,
            });

            return sendResponse({
                data,
                statusCode: StatusCodes.CREATED,
                success: true,
                message: messages.PAYMENT_ORDER_CREATED,
                response,
            });
        } catch (err: any) {
            return sendResponse({
                data: err,
                statusCode: err?.statusCode,
                success: false,
                message: err.error.description || messages.PAYMENT_ORDER_FAILED,
                response,
            });
        }
    }

    public async verifyPayment({
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
        userId,
        response,
    }: {
        razorpay_order_id: string;
        razorpay_payment_id: string;
        razorpay_signature: string;
        userId: string;
        response: Response;
    }) {
        try {
            const generatedSignature = crypto
                .createHmac("sha256", env.RAZORPAY_SECRET_KEY!)
                .update(`${razorpay_order_id}|${razorpay_payment_id}`)
                .digest("hex");

            if (generatedSignature !== razorpay_signature) {
                // Update order status to failed
                await bookConsultationOrderModel.findOneAndUpdate(
                    { order_id: razorpay_order_id },
                    { status: "failed" },
                );

                return sendResponse({
                    data: {},
                    statusCode: StatusCodes.BAD_REQUEST,
                    success: false,
                    message: messages.PAYMENT_VERIFICATION_FAILED,
                    response,
                });
            }
            // Payment is verified - update order status
            const updatedOrder = await bookConsultationOrderModel.findOneAndUpdate(
                { order_id: razorpay_order_id, user_id: userId },
                {
                    status: "paid",
                    payment_id: razorpay_payment_id,
                },
                { new: true },
            );

            if (!updatedOrder) {
                return sendResponse({
                    data: {},
                    statusCode: StatusCodes.NOT_FOUND,
                    success: false,
                    message: messages.ORDER_NOT_FOUND,
                    response,
                });
            }
            const isCareManager =
                updatedOrder.consultation_type === ConsultationTypeEnum.CARE_MANAGER;

            // Falls back to the pre-rename field. An order created just before this
            // version shipped still carries `expert_id`, and it may well be paid after
            // the deploy — the money is already captured by this point, so failing to
            // find the consultant here would take payment and create no booking.
            //
            // Read with strict:false because `expert_id` is no longer in the schema, and
            // mongoose hides undeclared paths from the hydrated document entirely — a
            // plain property access silently yields undefined.
            const consultantId =
                updatedOrder.consultant_id ??
                updatedOrder.get("expert_id", null, { strict: false }) ??
                null;

            // One order collection, two consultant collections — consultation_type is
            // the only thing that says which one to look in.
            const consultantInstance = consultantId
                ? isCareManager
                    ? await careManagerModel.findById(consultantId)
                    : await expertModel.findById(consultantId)
                : null;
            const userInstance = await UserModel.findById(updatedOrder.user_id);

            if (!consultantInstance) {
                throw new Error(
                    isCareManager ? messages.CARE_MANAGER_NOT_FOUND : messages.EXPERT_NOT_FOUND,
                );
            }

            if (!userInstance) {
                throw new Error(messages.USER_NOT_FOUND);
            }

            const consultation = await this.callbackRequestService.create({
                userId: updatedOrder.user_id,
                consultatorId: consultantId,
                consultationType: updatedOrder.consultation_type ?? ConsultationTypeEnum.EXPERT,
                requestStatus: "PENDING",
                preferred_consultation_date: updatedOrder.preferred_consultation_date,
                // Carried across from the order — the slot was chosen before the payment
                // sheet opened, and the consultation only exists now.
                preferred_slot: updatedOrder.preferred_slot,
                meeting_link: null,
                meeting_space_id: null,
                meeting_confirmed_at: null,
                // Nothing to remind about until a time is confirmed.
                reminders_sent: [],
                // Stamped explicitly so a refund knows to go back through the gateway
                // rather than the credit ledger. This is the pay-per-session path.
                paymentMode: EConsultationPaymentMode.PAID,
                credit_ledger_id: null,
            } as any);

            // Mints the Meet room and notifies the coordinator. Shared with the credit
            // routes so the two cannot drift — see ConsultationService.finalizeBooking.
            await this.callbackRequestService.finalizeBookingForPaidConsultation({
                consultation: consultation as any,
                consultantName: consultantInstance.name,
                contactWhatsappNumber: consultantInstance.contactWhatsappNumber || null,
                consultationType: updatedOrder.consultation_type,
                user: userInstance,
                amountPaise: updatedOrder.amount,
            });

            sendResponse({
                data: updatedOrder,
                statusCode: StatusCodes.OK,
                success: true,
                message: messages.PAYMENT_VERIFIED_SUCCESSFULLY,
                response,
            });
        } catch (error) {
            throw error;
        }
    }
}

export default BookConsultationPaymentService;
