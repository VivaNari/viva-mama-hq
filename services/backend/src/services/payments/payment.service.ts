import Razorpay from "razorpay";
import env from "../../config/env";
import paymentOrderModel from "../../models/payment-order.model";
import { ICreatePaymentOrderPayload, IPaymentOrder } from "../../types/payment.types";
import BaseService from "../base.service";
import sendResponse from "../../utils/commonFunctions/sendResponse";
import { StatusCodes } from "http-status-codes";
import crypto from "crypto";
import { Response } from "express";
import UserModel from "../../models/user.model";
import { IUser } from "../../types";
import { messages } from "../../constants/messages";

class PaymentService extends BaseService<IPaymentOrder> {
    private razorpayInstance;
    constructor() {
        super(paymentOrderModel);
        this.razorpayInstance = new Razorpay({
            key_id: env.RAZORPAY_API_KEY as string,
            key_secret: env.RAZORPAY_SECRET_KEY as string,
        });
    }

    public async createOrder({
        amount,
        plan,
        billingCycle,
        userId,
        response,
    }: ICreatePaymentOrderPayload) {
        // create the order in razorpay and send the order id to the client to proceed with the payment
        try {
            const options = {
                amount: amount * 100, // razorpay accepts paisa
                currency: "INR",
                receipt: "receipt_" + Date.now(),
            };

            const order = await this.razorpayInstance.orders.create(options);

            const data = await paymentOrderModel.create({
                order_id: order.id,
                receipt: order.receipt,
                user_id: userId,
                plan,
                billingCycle,
                amount: amount * 100,
                currency: "INR",
                status: "created",
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
                await paymentOrderModel.findOneAndUpdate(
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
            const updatedOrder = await paymentOrderModel.findOneAndUpdate(
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

            // Update user's subscription status here
            const user = await UserModel.findById(userId);
            await UserModel.findByIdAndUpdate(userId, {
                subscription: {
                    plan: updatedOrder.plan,
                    status: "active",
                    billingCycle: updatedOrder.billingCycle,
                    expiryDate: this.calculateExpiryDate(
                        updatedOrder.plan,
                        updatedOrder.billingCycle,
                    ),
                },
                is_onboarded: {
                    is_subscription_completed: true,
                    is_questionnaire_completed: user?.is_onboarded?.is_questionnaire_completed,
                },
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

    public async selectFreePlan({
        plan,
        billingCycle,
        userId,
        response,
    }: {
        plan: string;
        billingCycle: string;
        userId: string;
        response: Response;
    }) {
        try {
            const user = (await UserModel.findById(userId)) as IUser;
            if (!user) {
                sendResponse({
                    data: {},
                    statusCode: StatusCodes.NOT_FOUND,
                    success: false,
                    message: messages.USER_NOT_FOUND,
                    response,
                });
            }

            // Check if user already has an active subscription
            if (user.subscription?.status === "active") {
                console.log("User already has an active subscription");
                sendResponse({
                    data: {},
                    statusCode: StatusCodes.BAD_REQUEST,
                    success: false,
                    message: messages.USER_EXISTING_SUBCRIPTION_FOUND,
                    response,
                });
            }

            // Check if questionnaire is completed
            if (!user.is_onboarded?.is_questionnaire_completed) {
                sendResponse({
                    data: {},
                    statusCode: StatusCodes.BAD_REQUEST,
                    success: false,
                    message: messages.WARN_COMPLETE_QUESTIONNAIRE,
                    response,
                });
            }
            console.log("1234567890");
            const expiryDate = null;

            // Activate free plan
            const updatedUser = await UserModel.findByIdAndUpdate(
                userId,
                {
                    subscription: {
                        plan,
                        status: "active",
                        billingCycle,
                        expiryDate,
                    },
                    is_onboarded: {
                        is_subscription_completed: true,
                        is_questionnaire_completed: user?.is_onboarded?.is_questionnaire_completed,
                    },
                },
                { new: true },
            ).select("is_onboarded subscription");

            sendResponse({
                data: {
                    is_onboarded: updatedUser?.is_onboarded,
                    subscription: updatedUser?.subscription,
                },
                statusCode: StatusCodes.OK,
                success: true,
                message: `${plan} ${messages.PLAN_ACTIVATED_SUCCESSFULLY}`,
                response,
            });
        } catch (err) {
            console.log("Error occurred to subscribe free plan", err);
            throw err;
        }
    }

    private calculateExpiryDate = (plan: string, billingCycle: string) => {
        const now = new Date();
        if (billingCycle === "yearly") {
            now.setFullYear(now.getFullYear() + 1);
        } else if (billingCycle === "monthly") {
            now.setMonth(now.getMonth() + 1);
        }
        return now;
    };
}

export default PaymentService;
