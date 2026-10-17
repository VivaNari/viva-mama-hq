jest.mock(require.resolve("../src/config/firebase"), () => ({ __esModule: true, default: null }));
jest.mock(require.resolve("../src/config/redis.config"), () => ({ __esModule: true }));

// order.paid → reconcile → provider.fetchPaidPayment asks Razorpay. Mock the SDK so the
// test controls that answer.
const ordersFetch = jest.fn();
const ordersFetchPayments = jest.fn();
jest.mock("razorpay", () =>
    jest.fn().mockImplementation(() => ({
        orders: {
            create: jest.fn(),
            fetch: (...a: unknown[]) => ordersFetch(...a),
            fetchPayments: (...a: unknown[]) => ordersFetchPayments(...a),
        },
        subscriptions: { create: jest.fn(), cancel: jest.fn() },
    })),
);

import { connectTestDb, closeTestDb, clearTestDb } from "./helpers/db";
import UserModel from "../src/models/user.model";
import paymentOrderModel from "../src/models/payment-order.model";
import subscriptionPlanModel from "../src/models/subscription-plan.model";
import { webhookService } from "../src/services/subscription/webhook.service";
import { creditService } from "../src/services/entitlements/credit.service";
import {
    EBillingMode,
    EPaymentOrderPurpose,
    EPlanCode,
    ESubscriptionTier,
} from "../src/types/subscription.types";

jest.setTimeout(120000);

const ORDER_ID = "order_WH123";

function orderPaidEvent(id: string, orderId: string) {
    return {
        id,
        event: "order.paid",
        payload: { order: { entity: { id: orderId } } },
    };
}

async function seedPaidOrder() {
    await subscriptionPlanModel.create({
        code: EPlanCode.MONTHLY,
        displayName: "Monthly",
        amountPaise: 149900,
        durationDays: 30,
        credits: { expert: 1, careManager: 1 },
        razorpayPlanId: null,
    });
    const user = await UserModel.create({
        mobile_number: `9${Math.floor(Math.random() * 1_000_000_000)}`,
        subscription: { tier: ESubscriptionTier.FREE, hasUsedTrial: true },
    });
    await paymentOrderModel.create({
        order_id: ORDER_ID,
        receipt: "sub_MONTHLY",
        user_id: user._id,
        purpose: EPaymentOrderPurpose.SUBSCRIPTION,
        planCode: EPlanCode.MONTHLY,
        billingMode: EBillingMode.MANUAL,
        amount: 149900,
        currency: "INR",
        status: "created",
    });
    return user;
}

beforeAll(connectTestDb);
afterAll(closeTestDb);
beforeEach(async () => {
    await clearTestDb();
    ordersFetch.mockReset();
    ordersFetchPayments.mockReset();
});

describe("order.paid webhook (MANUAL safety net)", () => {
    it("activates the subscription and grants credits", async () => {
        const user = await seedPaidOrder();
        ordersFetch.mockResolvedValue({ status: "paid" });
        ordersFetchPayments.mockResolvedValue({
            items: [{ id: "pay_wh", status: "captured" }],
        });

        const result = await webhookService.handle(orderPaidEvent("evt_op_1", ORDER_ID));
        expect(result.processed).toBe(true);

        const fresh = await UserModel.findById(user._id).lean();
        expect(fresh!.subscription.tier).toBe(ESubscriptionTier.PREMIUM);
        expect(await creditService.getBalances(user._id)).toEqual({
            expert: 1,
            careManager: 1,
        });
    });

    // The webhook, the client callback and the client's error-path reconcile can all
    // fire for one payment — only one may grant credits.
    it("does not double-grant when redelivered", async () => {
        const user = await seedPaidOrder();
        ordersFetch.mockResolvedValue({ status: "paid" });
        ordersFetchPayments.mockResolvedValue({
            items: [{ id: "pay_wh", status: "captured" }],
        });

        const first = await webhookService.handle(orderPaidEvent("evt_op_a", ORDER_ID));
        // Same event id again → idempotency guard stops it before any work.
        const dup = await webhookService.handle(orderPaidEvent("evt_op_a", ORDER_ID));
        // Different event id, same order → reconcile sees it is already paid.
        const other = await webhookService.handle(orderPaidEvent("evt_op_b", ORDER_ID));

        expect(first.processed).toBe(true);
        expect(dup).toEqual({ processed: false, reason: "DUPLICATE" });
        expect(other.processed).toBe(true);
        expect(await creditService.getBalances(user._id)).toEqual({
            expert: 1,
            careManager: 1,
        });
    });

    it("ignores order.paid for an unknown order", async () => {
        const result = await webhookService.handle(orderPaidEvent("evt_op_x", "order_not_ours"));
        // Recorded and acknowledged so Razorpay stops retrying, but no activation.
        expect(result.processed).toBe(true);
    });
});
