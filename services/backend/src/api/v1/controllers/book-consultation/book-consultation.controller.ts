import { NextFunction, Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { messages } from "../../../../constants/messages";
import BookConsultationPaymentService from "../../../../services/book-consultation/book-consultation-payment.service";
import { AuthenticatedRequest } from "../../../../types/chat.types";
import sendResponse from "../../../../utils/commonFunctions/sendResponse";

export default class BookConsultationController {
    private bookConsultationService: BookConsultationPaymentService;
    constructor() {
        this.bookConsultationService = new BookConsultationPaymentService();
    }
    createOrder = async (request: Request, response: Response, next: NextFunction) => {
        try {
            const req = request as AuthenticatedRequest;
            const userId = req.user._id;

            const { amount, expertId, date } = req.body;

            if (!amount || !expertId || !date) {
                sendResponse({
                    data: {},
                    statusCode: StatusCodes.BAD_REQUEST,
                    success: false,
                    message: messages.MISSING_CREATE_CONSULTATION_ORDER_PARAMETERS,
                    response,
                });
            }

            await this.bookConsultationService.createOrder({
                amount,
                expertId,
                date,
                userId,
                response,
            });
        } catch (err) {
            next(err);
        }
    };

    verifyPayment = async (request: Request, response: Response, next: NextFunction) => {
        try {
            const req = request as AuthenticatedRequest;
            const userId = req.user._id;

            const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

            if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
                return sendResponse({
                    data: {},
                    statusCode: StatusCodes.BAD_REQUEST,
                    success: false,
                    message: messages.MISSING_PAYMENT_PARAMETERS,
                    response,
                });
            }

            await this.bookConsultationService.verifyPayment({
                razorpay_order_id,
                razorpay_payment_id,
                razorpay_signature,
                userId,
                response,
            });
        } catch (err) {
            next(err);
        }
    };
}
