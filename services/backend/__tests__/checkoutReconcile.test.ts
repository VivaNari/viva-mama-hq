jest.mock(require.resolve("../src/config/firebase"), () => ({ __esModule: true, default: null }));
jest.mock(require.resolve("../src/config/redis.config"), () => ({ __esModule: true }));

// The reconcile path asks Razorpay whether the order was paid. Mock the SDK so the test
// controls that answer instead of hitting the live API.
const ordersFetch = jest.fn();
const ordersFetchPayments = jest.fn();
jest.mock("razorpay", () =>
    jest.fn().mockImplementation(() => ({
        orders: {
            create: jest.fn(),
            fetch: (...a: unknown[]) => ordersFetch(...a),
            fetchPayments: (...a: unknown[]) => ordersFetchPayments(...a),
        },
    })),
);

import { connectTestDb, closeTestDb, clearTestDb } from "./helpers/db";
import UserModel from "../src/models/user.model";
import paymentOrderModel from "../src/models/payment-order.model";
import subscriptionPlanModel from "../src/models/subscription-plan.model";
import { subscriptionService } from "../src/services/subscription/subscription.service";
import { creditService } from "../src/services/entitlements/credit.service";
import {
    EBillingMode,
    EPaymentOrderPurpose,
    EPlanCode,
    ESubscriptionTier,
} from "../src/types/subscription.types";

jest.setTimeout(120000);

const ORDER_ID = "order_TEST123";

async function seedPlan() {
    await subscriptionPlanModel.create({
        code: EPlanCode.MONTHLY,
        displayName: "Monthly",
        amountPaise: 149900,
        durationDays: 30,
        credits: { expert: 1, careManager: 1 },
        razorpayPlanId: null,
    });
}

async function makeUserWithCreatedOrder() {
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
    await seedPlan();
});

describe("checkout reconcile — captured payment, no client callback", () => {
    it("activates premium and grants credits when Razorpay says the order is paid", async () => {
        const user = await makeUserWithCreatedOrder();
        ordersFetch.mockResolvedValue({ status: "paid" });
        ordersFetchPayments.mockResolvedValue({
            items: [{ id: "pay_1", status: "captured" }],
        });

        const result = await subscriptionService.reconcileCheckout(String(user._id), ORDER_ID);

        expect(result.activated).toBe(true);
        expect(result.subscription?.tier).toBe(ESubscriptionTier.PREMIUM);

        // The order is now settled, and the credits the user paid for exist.
        const order = await paymentOrderModel.findOne({ order_id: ORDER_ID });
        expect(order!.status).toBe("paid");
        expect(order!.razorpay_payment_id).toBe("pay_1");
        expect(await creditService.getBalances(user._id)).toEqual({
            expert: 1,
            careManager: 1,
        });

        const fresh = await UserModel.findById(user._id).lean();
        expect(fresh!.subscription.tier).toBe(ESubscriptionTier.PREMIUM);
        expect(fresh!.subscription.planCode).toBe(EPlanCode.MONTHLY);
    });

    it("does nothing when Razorpay says the order is not paid", async () => {
        const user = await makeUserWithCreatedOrder();
        ordersFetch.mockResolvedValue({ status: "created" });

        const result = await subscriptionService.reconcileCheckout(String(user._id), ORDER_ID);

        expect(result.activated).toBe(false);
        // Left at "created" so a later retry or webhook can still complete it.
        const order = await paymentOrderModel.findOne({ order_id: ORDER_ID });
        expect(order!.status).toBe("created");
        expect(await creditService.getBalances(user._id)).toEqual({
            expert: 0,
            careManager: 0,
        });
    });

    // The happy path may also have activated; reconcile must not grant a second time.
    it("is idempotent against an already-paid order", async () => {
        const user = await makeUserWithCreatedOrder();
        ordersFetch.mockResolvedValue({ status: "paid" });
        ordersFetchPayments.mockResolvedValue({
            items: [{ id: "pay_1", status: "captured" }],
        });

        await subscriptionService.reconcileCheckout(String(user._id), ORDER_ID);
        const second = await subscriptionService.reconcileCheckout(String(user._id), ORDER_ID);

        expect(second.activated).toBe(false);
        expect(await creditService.getBalances(user._id)).toEqual({
            expert: 1,
            careManager: 1,
        });
    });

    it("rejects an order that is not the caller's", async () => {
        await makeUserWithCreatedOrder();
        const other = await UserModel.create({
            mobile_number: "9111111111",
            subscription: { tier: ESubscriptionTier.FREE, hasUsedTrial: false },
        });

        await expect(
            subscriptionService.reconcileCheckout(String(other._id), ORDER_ID),
        ).rejects.toMatchObject({ code: "ORDER_NOT_FOUND" });
    });
});
