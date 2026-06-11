import { NextFunction, Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import PaymentService from "../../../../services/payments/payment.service";
import { AuthenticatedRequest } from "../../../../types/chat.types";
import sendResponse from "../../../../utils/commonFunctions/sendResponse";
import { messages } from "../../../../constants/messages";

export default class PaymentController {
    private paymentService: PaymentService;
    constructor() {
        this.paymentService = new PaymentService();
    }
    createOrder = async (request: Request, response: Response, next: NextFunction) => {
        try {
            const req = request as AuthenticatedRequest;
            const userId = req.user._id;

            const { amount, plan, billingCycle } = req.body;

            if (!amount || !plan || !billingCycle) {
                sendResponse({
                    data: {},
                    statusCode: StatusCodes.BAD_REQUEST,
                    success: false,
                    message: messages.MISSING_CREATE_ORDER_PARAMETERS,
                    response,
                });
            }

            await this.paymentService.createOrder({
                amount,
                plan,
                billingCycle,
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

            await this.paymentService.verifyPayment({
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

    selectFreePlan = async (request: Request, response: Response, next: NextFunction) => {
        try {
            const req = request as AuthenticatedRequest;
            const userId = req.user._id;

            const { plan, billingCycle } = req.body;
            console.log(plan, billingCycle);
            if (!plan || !billingCycle) {
                sendResponse({
                    data: {},
                    statusCode: StatusCodes.BAD_REQUEST,
                    success: false,
                    message: messages.MISSING_FREE_PLAN_PARAMETERS,
                    response,
                });
            }

            await this.paymentService.selectFreePlan({
                plan,
                billingCycle,
                userId,
                response,
            });
        } catch (err) {
            next(err);
        }
    };
}
