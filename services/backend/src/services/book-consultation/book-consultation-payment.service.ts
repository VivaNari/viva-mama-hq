import crypto from "crypto";
import { Response } from "express";
import { StatusCodes } from "http-status-codes";
import Razorpay from "razorpay";
import env from "../../config/env";
import { messages } from "../../constants/messages";

import { expert } from "../../constants/expert";
import bookConsultationOrderModel from "../../models/book-consultation.model";
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
import { sendWhatsappMessageForExpertConsultation } from "../getgabs/sendWhatsappMessageForExpertConsultation";

class BookConsultationPaymentService extends BaseService<IBookConsultationOrder> {
    private razorpayInstance;
    private callbackRequestService: ConsultationService = new ConsultationService();
    constructor() {
        super(bookConsultationOrderModel);
        this.razorpayInstance = new Razorpay({
            key_id: env.RAZORPAY_API_KEY as string,
            key_secret: env.RAZORPAY_SECRET_KEY as string,
        });
        this.callbackRequestService = new ConsultationService();
    }

    public async createOrder({
        amount,
        expertId,
        date,
        userId,
        response,
    }: ICreateIBookConsultationOrderPayload) {
        // create the order in razorpay and send the order id to the client to proceed with the payment
        try {
            const options = {
                amount: amount * 100, // razorpay accepts paisa
                currency: "INR",
                receipt: "receipt_" + Date.now(),
            };

            const order = await this.razorpayInstance.orders.create(options);

            const data = await bookConsultationOrderModel.create({
                order_id: order.id,
                receipt: order.receipt,
                user_id: userId,
                expert_id: expertId,
                amount: amount * 100,
                currency: "INR",
                status: "created",
                preferred_consultation_date: date,
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
            const expertInstance = await expertModel.findById(updatedOrder.expert_id);
            const userInstance = await UserModel.findById(updatedOrder.user_id);

            if (!expertInstance) {
                throw new Error(messages.EXPERT_NOT_FOUND);
            }

            if (!userInstance) {
                throw new Error(messages.USER_NOT_FOUND);
            }

            // Create callback request for expert
            await this.callbackRequestService.create({
                userId: updatedOrder.user_id,
                consultatorId: updatedOrder.expert_id,
                consultationType: ConsultationTypeEnum.EXPERT,
                requestStatus: "PENDING",
                preferred_consultation_date: updatedOrder.preferred_consultation_date,
            } as any);

            try {
                // await sendWhatsAppMessage(expert.whatsappMessageReceiver, message);
                await sendWhatsappMessageForExpertConsultation({
                    to: expert.whatsappMessageReceiver,
                    expertId: expertInstance._id.toString(),
                    expertName: expertInstance.name,
                    userId: userInstance._id.toString(),
                    userEmailOrPhone: userInstance.email || userInstance.mobile_number || "",
                });
            } catch (err) {
                console.error("WhatsApp failed (ignored)", err);
            }

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
