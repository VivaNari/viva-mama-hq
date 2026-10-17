import { NextFunction, Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { messages } from "../../../../constants/messages";
import BookConsultationPaymentService from "../../../../services/book-consultation/book-consultation-payment.service";
import { AuthenticatedRequest } from "../../../../types/chat.types";
import sendResponse from "../../../../utils/commonFunctions/sendResponse";
import { EPreferredSlot } from "../../../../constants/consultation-slots";
import { ConsultationTypeEnum } from "../../../../types/consultation.types";

export default class BookConsultationController {
    private bookConsultationService: BookConsultationPaymentService;
    constructor() {
        this.bookConsultationService = new BookConsultationPaymentService();
    }
    createOrder = async (request: Request, response: Response, next: NextFunction) => {
        try {
            const req = request as AuthenticatedRequest;
            const userId = req.user._id;

            // `expertId` is still accepted so an app build that predates counsellor
            // payments keeps working; it means the same thing as consultantId.
            //
            // `amount` is deliberately not read. The service resolves the fee from the
            // consultant's document, so a client that sends one is ignored rather than
            // trusted — and one that sends none is no longer refused.
            const {
                consultantId,
                expertId,
                consultationType = ConsultationTypeEnum.EXPERT,
                date,
                preferredSlot,
            } = req.body;

            const resolvedConsultantId = consultantId || expertId;

            if (
                !resolvedConsultantId ||
                !date ||
                !preferredSlot ||
                !Object.values(EPreferredSlot).includes(preferredSlot) ||
                !Object.values(ConsultationTypeEnum).includes(consultationType)
            ) {
                return sendResponse({
                    data: {},
                    statusCode: StatusCodes.BAD_REQUEST,
                    success: false,
                    message: messages.MISSING_CREATE_CONSULTATION_ORDER_PARAMETERS,
                    response,
                });
            }

            await this.bookConsultationService.createOrder({
                consultantId: resolvedConsultantId,
                consultationType,
                date,
                preferredSlot,
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
