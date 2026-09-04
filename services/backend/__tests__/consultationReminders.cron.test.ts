jest.mock(require.resolve("../src/config/firebase"), () => ({ __esModule: true, default: null }));
jest.mock(require.resolve("../src/config/redis.config"), () => ({ __esModule: true }));
jest.mock("razorpay", () =>
    jest.fn().mockImplementation(() => ({ orders: { create: jest.fn() } })),
);

const sendPushNotificationMock = jest.fn(async () => undefined);
jest.mock(require.resolve("../src/utils/sendPushNotification"), () => ({
    __esModule: true,
    sendPushNotification: (...args: unknown[]) => sendPushNotificationMock(...(args as [])),
}));

import { connectTestDb, closeTestDb, clearTestDb } from "./helpers/db";
import consultationModel from "../src/models/consultation.model";
import expertModel from "../src/models/expert.model";
import expertCategoryModel from "../src/models/expert-category.model";
import UserModel from "../src/models/user.model";
import { consultationReminders } from "../src/cron-jobs/consultationReminders";
import { CallbackRequestStatusEnum, ConsultationTypeEnum } from "../src/types/consultation.types";
import { EPreferredSlot } from "../src/constants/consultation-slots";

jest.setTimeout(120000);

/** The call everything below is measured against: confirmed for 5:00 pm IST. */
const CONFIRMED_AT = new Date("2026-07-22T11:30:00.000Z"); // 17:00 IST
const AT_60_BEFORE = new Date("2026-07-22T10:30:00.000Z"); // 16:00 IST
const AT_15_BEFORE = new Date("2026-07-22T11:15:00.000Z"); // 16:45 IST

const minutes = (n: number) => n * 60_000;

async function makeUser(withToken = true) {
    return UserModel.create({
        mobile_number: `9${Math.floor(Math.random() * 1_000_000_000)}`,
        FCM_token: withToken ? "fcm-token" : undefined,
    });
}

async function makeExpert() {
    const category = await expertCategoryModel.findOneAndUpdate(
        { key: "GYNECOLOGIST" },
        { $setOnInsert: { key: "GYNECOLOGIST", name: "Gynaecologist", coveredAreas: ["a"] } },
        { upsert: true, new: true },
    );
    return expertModel.create({
        name: "Dr. Anita Rao",
        speciality: "Gynaecology",
        category: category!._id,
        yearsOfExperience: 12,
        photograph: "https://example.com/a.jpg",
        remuneration: 199,
        is_empanelled_expert: true,
        referralCode: `REF${Math.random().toString(36).slice(2, 10)}`,
    });
}

async function makeConsultation(
    userId: unknown,
    expertId: unknown,
    overrides: Record<string, unknown> = {},
) {
    return consultationModel.create({
        userId,
        consultatorId: expertId,
        consultationType: ConsultationTypeEnum.EXPERT,
        requestStatus: CallbackRequestStatusEnum.PENDING,
        preferred_consultation_date: CONFIRMED_AT,
        preferred_slot: EPreferredSlot.EVENING,
        meeting_confirmed_at: CONFIRMED_AT,
        ...overrides,
    });
}

beforeAll(connectTestDb);
afterAll(closeTestDb);
beforeEach(async () => {
    await clearTestDb();
    sendPushNotificationMock.mockClear();
});

describe("consultationReminders", () => {
    it("sends the 1-hour reminder at T-60 and records it", async () => {
        const user = await makeUser();
        const expert = await makeExpert();
        const consultation = await makeConsultation(user._id, expert._id);

        const result = await consultationReminders(AT_60_BEFORE);

        expect(result.sent).toBe(1);
        expect(sendPushNotificationMock).toHaveBeenCalledTimes(1);

        const [payload] = sendPushNotificationMock.mock.calls[0] as unknown as [
            { data: Record<string, string>; body: string },
        ];
        expect(payload.data).toMatchObject({
            type: "CONSULTATION_REMINDER",
            consultationId: String(consultation._id),
            minutesBefore: "60",
        });
        // The clock time, not the offset — a notification read late must still be true.
        expect(payload.body).toContain("Dr. Anita Rao");
        expect(payload.body).toContain("5:00 pm");

        const stored = await consultationModel.findById(consultation._id).lean();
        expect(stored!.reminders_sent).toEqual([60]);
    });

    it("sends the 15-minute reminder at T-15", async () => {
        const user = await makeUser();
        const expert = await makeExpert();
        const consultation = await makeConsultation(user._id, expert._id, { reminders_sent: [60] });

        const result = await consultationReminders(AT_15_BEFORE);

        expect(result.sent).toBe(1);
        const stored = await consultationModel.findById(consultation._id).lean();
        expect(stored!.reminders_sent!.sort()).toEqual([15, 60]);
    });

    /**
     * The whole reason sends are recorded rather than derived. At a five-minute cadence
     * the same offset stays "due" for several consecutive runs.
     */
    it("does not re-send on the next run five minutes later", async () => {
        const user = await makeUser();
        const expert = await makeExpert();
        await makeConsultation(user._id, expert._id);

        await consultationReminders(AT_60_BEFORE);
        sendPushNotificationMock.mockClear();

        const second = await consultationReminders(new Date(AT_60_BEFORE.getTime() + minutes(5)));

        expect(second.sent).toBe(0);
        expect(sendPushNotificationMock).not.toHaveBeenCalled();
    });

    it("never fires early", async () => {
        const user = await makeUser();
        const expert = await makeExpert();
        await makeConsultation(user._id, expert._id);

        // One minute before the 1-hour mark.
        const result = await consultationReminders(new Date(AT_60_BEFORE.getTime() - minutes(1)));

        expect(result.sent).toBe(0);
        expect(sendPushNotificationMock).not.toHaveBeenCalled();
    });

    /**
     * A booking confirmed 20 minutes before the call can never get a useful 1-hour
     * warning. Sending it anyway would tell her the call is an hour away while it is
     * minutes away.
     */
    it("skips an offset missed by more than the tolerance", async () => {
        const user = await makeUser();
        const expert = await makeExpert();
        await makeConsultation(user._id, expert._id);

        const result = await consultationReminders(new Date(AT_60_BEFORE.getTime() + minutes(30)));

        expect(result.sent).toBe(0);
        expect(sendPushNotificationMock).not.toHaveBeenCalled();
    });

    it("still fires an offset that is late but within tolerance", async () => {
        const user = await makeUser();
        const expert = await makeExpert();
        await makeConsultation(user._id, expert._id);

        // A skipped run: 6 minutes past the mark.
        const result = await consultationReminders(new Date(AT_60_BEFORE.getTime() + minutes(6)));

        expect(result.sent).toBe(1);
    });

    it.each([CallbackRequestStatusEnum.COMPLETED, CallbackRequestStatusEnum.UNHANDLED])(
        "ignores a %s consultation",
        async (requestStatus) => {
            const user = await makeUser();
            const expert = await makeExpert();
            await makeConsultation(user._id, expert._id, { requestStatus });

            const result = await consultationReminders(AT_60_BEFORE);

            expect(result.sent).toBe(0);
            expect(sendPushNotificationMock).not.toHaveBeenCalled();
        },
    );

    it("ignores a booking with no confirmed time", async () => {
        const user = await makeUser();
        const expert = await makeExpert();
        await makeConsultation(user._id, expert._id, { meeting_confirmed_at: null });

        const result = await consultationReminders(AT_60_BEFORE);

        expect(result.sent).toBe(0);
    });

    it("skips a user with no device token without marking the reminder sent", async () => {
        const user = await makeUser(false);
        const expert = await makeExpert();
        const consultation = await makeConsultation(user._id, expert._id);

        const result = await consultationReminders(AT_60_BEFORE);

        expect(result.sent).toBe(0);
        expect(sendPushNotificationMock).not.toHaveBeenCalled();
        // Left unclaimed: she may register a token before the 15-minute mark.
        const stored = await consultationModel.findById(consultation._id).lean();
        expect(stored!.reminders_sent).toEqual([]);
    });

    it("still names the call when the consultant record is gone", async () => {
        const user = await makeUser();
        const expert = await makeExpert();
        await makeConsultation(user._id, expert._id);
        await expertModel.deleteOne({ _id: expert._id });

        const result = await consultationReminders(AT_60_BEFORE);

        expect(result.sent).toBe(1);
        const [payload] = sendPushNotificationMock.mock.calls[0] as unknown as [{ body: string }];
        expect(payload.body).toContain("your consultant");
    });

    it("sends both reminders across the two runs that are due", async () => {
        const user = await makeUser();
        const expert = await makeExpert();
        const consultation = await makeConsultation(user._id, expert._id);

        await consultationReminders(AT_60_BEFORE);
        await consultationReminders(AT_15_BEFORE);

        expect(sendPushNotificationMock).toHaveBeenCalledTimes(2);
        const stored = await consultationModel.findById(consultation._id).lean();
        expect(stored!.reminders_sent!.sort()).toEqual([15, 60]);
    });

    /**
     * Every consultation already in the database predates `reminders_sent`, and the
     * schema default only applies to new documents. This is why the field needs no
     * backfill migration: an absent array reads as empty, `$ne` matches a missing field,
     * and `$addToSet` creates it on first write.
     */
    it("handles a document that predates the reminders_sent field", async () => {
        const user = await makeUser();
        const expert = await makeExpert();
        const consultation = await makeConsultation(user._id, expert._id);

        // Strip it the way a pre-migration document would be — the schema default
        // cannot be avoided at create() time.
        await consultationModel.collection.updateOne(
            { _id: consultation._id },
            { $unset: { reminders_sent: "" } },
        );
        const before = await consultationModel.collection.findOne({ _id: consultation._id });
        expect(before).not.toHaveProperty("reminders_sent");

        const result = await consultationReminders(AT_60_BEFORE);

        expect(result.sent).toBe(1);
        const stored = await consultationModel.findById(consultation._id).lean();
        expect(stored!.reminders_sent).toEqual([60]);
    });

    /** Overlapping runs must not double-notify — the $addToSet claim is what decides. */
    it("notifies once when two runs overlap on the same offset", async () => {
        const user = await makeUser();
        const expert = await makeExpert();
        await makeConsultation(user._id, expert._id);

        const results = await Promise.all([
            consultationReminders(AT_60_BEFORE),
            consultationReminders(AT_60_BEFORE),
        ]);

        expect(results.reduce((n, r) => n + r.sent, 0)).toBe(1);
        expect(sendPushNotificationMock).toHaveBeenCalledTimes(1);
    });
});
