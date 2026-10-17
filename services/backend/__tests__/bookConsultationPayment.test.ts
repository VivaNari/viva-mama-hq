/**
 * The pay-per-session path, end to end: create an order, then verify the payment and
 * turn it into a booking.
 *
 * This route handles real money and was previously untested. The cases that matter are
 * the ones where a payment is captured but the booking does not appear — a forged
 * signature, a consultant that cannot be found, an order shaped by an older release.
 */

jest.mock(require.resolve("../src/config/firebase"), () => ({ __esModule: true, default: null }));
jest.mock(require.resolve("../src/config/redis.config"), () => ({ __esModule: true }));

const mockOrdersCreate = jest.fn();
jest.mock("razorpay", () =>
    jest.fn().mockImplementation(() => ({ orders: { create: mockOrdersCreate } })),
);

const mockSendWhatsapp = jest.fn(async () => undefined);
jest.mock(
    require.resolve("../src/services/getgabs/sendWhatsappMessageForConsultationBooking"),
    () => ({
        __esModule: true,
        EConsultationBookingTemplate: {
            EXPERT: "expert_consultation_booking_v2",
            CARE_MANAGER: "care_manager_callback_v2",
        },
        sendWhatsappMessageForConsultationBooking: mockSendWhatsapp,
    }),
);

const mockCreateMeetSpace = jest.fn(async () => null as any);
jest.mock(require.resolve("../src/services/google-meet/meet-space.service"), () => ({
    __esModule: true,
    meetSpaceService: { createMeetSpace: mockCreateMeetSpace },
}));

import crypto from "crypto";
import { clearTestDb, closeTestDb, connectTestDb } from "./helpers/db";
import env from "../src/config/env";
import BookConsultationPaymentService from "../src/services/book-consultation/book-consultation-payment.service";
import bookConsultationOrderModel from "../src/models/book-consultation.model";
import careManagerModel from "../src/models/care-manager.model";
import consultationModel from "../src/models/consultation.model";
import expertModel from "../src/models/expert.model";
import expertCategoryModel from "../src/models/expert-category.model";
import UserModel from "../src/models/user.model";
import { EPreferredSlot } from "../src/constants/consultation-slots";
import { messages } from "../src/constants/messages";
import { ConsultationTypeEnum } from "../src/types/consultation.types";
import { EConsultationPaymentMode } from "../src/types/subscription.types";

jest.setTimeout(120000);

const service = new BookConsultationPaymentService();

/** Minimal Express response double — the service reports through sendResponse. */
function fakeResponse() {
    const res: any = {
        statusCode: undefined as number | undefined,
        body: undefined as any,
        status(code: number) {
            res.statusCode = code;
            return res;
        },
        json(payload: any) {
            res.body = payload;
            return res;
        },
    };
    return res;
}

/** A date far enough out that the two-hour lead check always passes. */
const futureDate = () => new Date(Date.now() + 7 * 86_400_000).toISOString();

async function makeUser() {
    return UserModel.create({
        mobile_number: `9${Math.floor(Math.random() * 1_000_000_000)}`,
        onboarding_data: { preferred_name: "Priya" },
    });
}

async function makeExpert(overrides: Record<string, unknown> = {}) {
    const category = await expertCategoryModel.create({
        key: "GYNECOLOGIST",
        name: "Gynaecologist",
        coveredAreas: ["a"],
    });
    return expertModel.create({
        name: "Dr. Anita Rao",
        speciality: "Gynaecology",
        category: category._id,
        yearsOfExperience: 12,
        photograph: "https://example.com/a.jpg",
        remuneration: 800,
        contactWhatsappNumber: "919599691619",
        ...overrides,
    });
}

async function makeCareManager() {
    return careManagerModel.create({
        name: "Meera",
        email: "meera@example.com",
        phoneNumber: "9000000000",
        contactWhatsappNumber: "919599691619",
        remuneration: 99,
    });
}

/** A signature Razorpay would consider valid for this order/payment pair. */
function signFor(orderId: string, paymentId: string) {
    return crypto
        .createHmac("sha256", env.RAZORPAY_SECRET_KEY!)
        .update(`${orderId}|${paymentId}`)
        .digest("hex");
}

beforeAll(async () => {
    // The service signs with this at import time; tests need a deterministic value.
    (env as any).RAZORPAY_SECRET_KEY = "test_secret";
    await connectTestDb();
});
afterAll(closeTestDb);
beforeEach(async () => {
    await clearTestDb();
    mockOrdersCreate.mockReset();
    mockSendWhatsapp.mockClear();
    mockCreateMeetSpace.mockReset().mockResolvedValue(null);
    jest.spyOn(console, "error").mockImplementation(() => undefined);
});
afterEach(() => jest.restoreAllMocks());

describe("createOrder", () => {
    it("stores the consultant, type and slot on the order", async () => {
        const expert = await makeExpert();
        const user = await makeUser();
        mockOrdersCreate.mockResolvedValue({ id: "order_x1", receipt: "receipt_1" });

        await service.createOrder({
            amount: 800,
            consultantId: String(expert._id),
            consultationType: ConsultationTypeEnum.EXPERT,
            date: futureDate(),
            preferredSlot: EPreferredSlot.MORNING,
            userId: String(user._id),
            response: fakeResponse(),
        });

        const order = await bookConsultationOrderModel.findOne({ order_id: "order_x1" });
        expect(order).toBeTruthy();
        expect(String(order!.consultant_id)).toBe(String(expert._id));
        expect(order!.consultation_type).toBe(ConsultationTypeEnum.EXPERT);
        expect(order!.preferred_slot).toBe(EPreferredSlot.MORNING);
        // Razorpay charges in paise.
        expect(order!.amount).toBe(80_000);
        expect(order!.status).toBe("created");
    });

    it("opens a care-manager order against the care_managers collection", async () => {
        const careManager = await makeCareManager();
        const user = await makeUser();
        mockOrdersCreate.mockResolvedValue({ id: "order_cm", receipt: "receipt_cm" });

        await service.createOrder({
            amount: 99,
            consultantId: String(careManager._id),
            consultationType: ConsultationTypeEnum.CARE_MANAGER,
            date: futureDate(),
            preferredSlot: EPreferredSlot.EVENING,
            userId: String(user._id),
            response: fakeResponse(),
        });

        const order = await bookConsultationOrderModel.findOne({ order_id: "order_cm" });
        expect(order!.consultation_type).toBe(ConsultationTypeEnum.CARE_MANAGER);
        expect(order!.amount).toBe(9_900);
    });

    /**
     * The fee is the consultant's, not the caller's. Taking `amount` from the body let a
     * client book a ₹800 expert for ₹1 — and underpaying is simply the cheaper route to
     * the same consultation, which would undo the point of restricting credits to the
     * in-house panel.
     */
    it("ignores the amount in the request and charges the expert's fee", async () => {
        const expert = await makeExpert(); // remuneration: 800
        const user = await makeUser();
        mockOrdersCreate.mockResolvedValue({ id: "order_cheat", receipt: "receipt_cheat" });

        await service.createOrder({
            amount: 1,
            consultantId: String(expert._id),
            consultationType: ConsultationTypeEnum.EXPERT,
            date: futureDate(),
            preferredSlot: EPreferredSlot.MORNING,
            userId: String(user._id),
            response: fakeResponse(),
        });

        expect(mockOrdersCreate).toHaveBeenCalledWith(expect.objectContaining({ amount: 80_000 }));
        const order = await bookConsultationOrderModel.findOne({ order_id: "order_cheat" });
        expect(order!.amount).toBe(80_000);
    });

    /**
     * A zero fee is a referring doctor who consults at her own clinic, not a mis-seeded
     * document. Razorpay cannot raise an order for ₹0, so this has to be refused — and
     * refused by name, so the app can say "meet her in person" rather than repeating the
     * generic "fee is not set up yet".
     */
    it("refuses an in-person-only expert before reaching Razorpay", async () => {
        const expert = await makeExpert({ remuneration: 0 });
        const user = await makeUser();
        const response = fakeResponse();

        await service.createOrder({
            amount: 0,
            consultantId: String(expert._id),
            consultationType: ConsultationTypeEnum.EXPERT,
            date: futureDate(),
            preferredSlot: EPreferredSlot.MORNING,
            userId: String(user._id),
            response,
        });

        expect(response.statusCode).toBe(409);
        expect(response.body?.message).toBe(messages.EXPERT_IN_PERSON_ONLY);
        expect(mockOrdersCreate).not.toHaveBeenCalled();
        expect(await bookConsultationOrderModel.countDocuments({})).toBe(0);
    });

    it("answers 404 for a consultant that does not exist", async () => {
        const user = await makeUser();
        const response = fakeResponse();

        await service.createOrder({
            amount: 800,
            consultantId: "5f0000000000000000000aaa",
            consultationType: ConsultationTypeEnum.EXPERT,
            date: futureDate(),
            preferredSlot: EPreferredSlot.MORNING,
            userId: String(user._id),
            response,
        });

        expect(response.statusCode).toBe(404);
        expect(mockOrdersCreate).not.toHaveBeenCalled();
        expect(await bookConsultationOrderModel.countDocuments({})).toBe(0);
    });

    /**
     * Refused before the payment sheet opens rather than after. Rejecting on verify would
     * mean refunding a captured payment.
     */
    it("refuses a slot that has already passed, without reaching Razorpay", async () => {
        const expert = await makeExpert();
        const user = await makeUser();
        const response = fakeResponse();

        await service.createOrder({
            amount: 800,
            consultantId: String(expert._id),
            consultationType: ConsultationTypeEnum.EXPERT,
            // Yesterday: no window on it can still be two hours away.
            date: new Date(Date.now() - 86_400_000).toISOString(),
            preferredSlot: EPreferredSlot.MORNING,
            userId: String(user._id),
            response,
        });

        expect(response.statusCode).toBe(400);
        expect(response.body.success).toBe(false);
        expect(mockOrdersCreate).not.toHaveBeenCalled();
        expect(await bookConsultationOrderModel.countDocuments({})).toBe(0);
    });
});

describe("verifyPayment", () => {
    async function seedOrder(overrides: Record<string, unknown> = {}) {
        const user = await makeUser();
        const expert = await makeExpert();
        const order = await bookConsultationOrderModel.create({
            order_id: "order_v1",
            receipt: "receipt_v1",
            user_id: user._id,
            consultant_id: expert._id,
            consultation_type: ConsultationTypeEnum.EXPERT,
            amount: 80_000,
            currency: "INR",
            status: "created",
            preferred_consultation_date: new Date(futureDate()),
            preferred_slot: EPreferredSlot.MORNING,
            ...overrides,
        });
        return { user, expert, order };
    }

    it("turns a verified payment into a PAID consultation carrying the slot", async () => {
        const { user, expert } = await seedOrder();
        const response = fakeResponse();

        await service.verifyPayment({
            razorpay_order_id: "order_v1",
            razorpay_payment_id: "pay_1",
            razorpay_signature: signFor("order_v1", "pay_1"),
            userId: String(user._id),
            response,
        });

        expect(response.statusCode).toBe(200);

        const consultation = await consultationModel.findOne({ userId: user._id });
        expect(consultation).toBeTruthy();
        expect(String(consultation!.consultatorId)).toBe(String(expert._id));
        expect(consultation!.consultationType).toBe(ConsultationTypeEnum.EXPERT);
        expect(consultation!.preferred_slot).toBe(EPreferredSlot.MORNING);
        // Refunds for this booking go back through the gateway, not the credit ledger.
        expect(consultation!.paymentMode).toBe(EConsultationPaymentMode.PAID);
        expect(consultation!.credit_ledger_id).toBeNull();

        const order = await bookConsultationOrderModel.findOne({ order_id: "order_v1" });
        expect(order!.status).toBe("paid");
    });

    it("mints a Meet room and stores it on the consultation", async () => {
        mockCreateMeetSpace.mockResolvedValue({
            meetingUri: "https://meet.google.com/knh-fyph-cuc",
            spaceName: "spaces/abc",
        } as any);
        const { user } = await seedOrder();

        await service.verifyPayment({
            razorpay_order_id: "order_v1",
            razorpay_payment_id: "pay_1",
            razorpay_signature: signFor("order_v1", "pay_1"),
            userId: String(user._id),
            response: fakeResponse(),
        });

        const consultation = await consultationModel.findOne({ userId: user._id });
        expect(consultation!.meeting_link).toBe("https://meet.google.com/knh-fyph-cuc");
        expect(consultation!.meeting_space_id).toBe("spaces/abc");
        // Nobody has agreed a time yet — the Join button stays locked until they do.
        expect(consultation!.meeting_confirmed_at).toBeNull();
    });

    it("notifies the coordinator with the fee, not a credit balance", async () => {
        const { user } = await seedOrder();

        await service.verifyPayment({
            razorpay_order_id: "order_v1",
            razorpay_payment_id: "pay_1",
            razorpay_signature: signFor("order_v1", "pay_1"),
            userId: String(user._id),
            response: fakeResponse(),
        });

        expect(mockSendWhatsapp).toHaveBeenCalledWith(
            "expert_consultation_booking_v2",
            expect.objectContaining({
                to: "919599691619",
                consultantName: "Dr. Anita Rao",
                payment: "Paid ₹800",
                // Generation was stubbed to null; the coordinator must be told a link is
                // coming rather than left with a blank field.
                joinLink: "Link to follow",
            }),
        );
    });

    it("books a care manager against the care-manager template", async () => {
        const careManager = await makeCareManager();
        const { user } = await seedOrder({
            consultant_id: careManager._id,
            consultation_type: ConsultationTypeEnum.CARE_MANAGER,
            amount: 9_900,
        });

        await service.verifyPayment({
            razorpay_order_id: "order_v1",
            razorpay_payment_id: "pay_1",
            razorpay_signature: signFor("order_v1", "pay_1"),
            userId: String(user._id),
            response: fakeResponse(),
        });

        const consultation = await consultationModel.findOne({ userId: user._id });
        expect(consultation!.consultationType).toBe(ConsultationTypeEnum.CARE_MANAGER);
        expect(mockSendWhatsapp).toHaveBeenCalledWith(
            "care_manager_callback_v2",
            expect.objectContaining({ consultantName: "Meera", payment: "Paid ₹99" }),
        );
    });

    /**
     * The signature is the only thing standing between a forged callback and a free
     * consultation. A mismatch must mark the order failed and create nothing.
     */
    it("rejects a forged signature and creates no consultation", async () => {
        const { user } = await seedOrder();
        const response = fakeResponse();

        await service.verifyPayment({
            razorpay_order_id: "order_v1",
            razorpay_payment_id: "pay_1",
            razorpay_signature: "deadbeef",
            userId: String(user._id),
            response,
        });

        expect(response.statusCode).toBe(400);
        expect(await consultationModel.countDocuments({})).toBe(0);

        const order = await bookConsultationOrderModel.findOne({ order_id: "order_v1" });
        expect(order!.status).toBe("failed");
        expect(mockSendWhatsapp).not.toHaveBeenCalled();
    });

    it("answers 404 when the order does not belong to the caller", async () => {
        await seedOrder();
        const otherUser = await makeUser();
        const response = fakeResponse();

        await service.verifyPayment({
            razorpay_order_id: "order_v1",
            razorpay_payment_id: "pay_1",
            razorpay_signature: signFor("order_v1", "pay_1"),
            userId: String(otherUser._id),
            response,
        });

        expect(response.statusCode).toBe(404);
        expect(await consultationModel.countDocuments({})).toBe(0);
    });

    /**
     * An order opened before the consultant_id rename shipped, paid after the deploy.
     * The money is already captured by this point, so falling back to the old field is
     * what stops a payment existing with no booking behind it.
     */
    it("still books an order that predates the consultant_id rename", async () => {
        const user = await makeUser();
        const expert = await makeExpert();

        // Written through the raw collection: the schema no longer declares expert_id.
        // Name taken from the model — it is "bookconsultation_orders", not the
        // "book_consultation_orders" you would guess.
        await bookConsultationOrderModel.collection.insertOne({
            order_id: "order_legacy",
            receipt: "receipt_legacy",
            user_id: user._id,
            expert_id: expert._id,
            amount: 80_000,
            currency: "INR",
            status: "created",
            preferred_consultation_date: new Date(futureDate()),
        });

        const response = fakeResponse();
        await service.verifyPayment({
            razorpay_order_id: "order_legacy",
            razorpay_payment_id: "pay_legacy",
            razorpay_signature: signFor("order_legacy", "pay_legacy"),
            userId: String(user._id),
            response,
        });

        expect(response.statusCode).toBe(200);
        const consultation = await consultationModel.findOne({ userId: user._id });
        expect(consultation).toBeTruthy();
        expect(String(consultation!.consultatorId)).toBe(String(expert._id));
        expect(consultation!.consultationType).toBe(ConsultationTypeEnum.EXPERT);
    });

    /**
     * Both are best-effort. The payment has settled; a Google or GetGabs outage must not
     * unwind a booking the user has already been charged for.
     */
    it("still books when the Meet API and WhatsApp both fail", async () => {
        mockCreateMeetSpace.mockRejectedValue(new Error("meet down"));
        mockSendWhatsapp.mockRejectedValue(new Error("getgabs down") as never);
        const { user } = await seedOrder();
        const response = fakeResponse();

        await service.verifyPayment({
            razorpay_order_id: "order_v1",
            razorpay_payment_id: "pay_1",
            razorpay_signature: signFor("order_v1", "pay_1"),
            userId: String(user._id),
            response,
        });

        expect(response.statusCode).toBe(200);
        const consultation = await consultationModel.findOne({ userId: user._id });
        expect(consultation).toBeTruthy();
        expect(consultation!.meeting_link).toBeNull();
    });
});
