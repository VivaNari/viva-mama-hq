/**
 * babyAgeReminders: has a child reached a vaccination visit or milestone band that still
 * has something unlogged in it, and if so, is it time to say so.
 *
 * Fixed dates throughout rather than relative ones, matching `vaccinationDueWindow`'s own
 * test in the mobile suite: dob 14 Jan 2026 is exactly 6 weeks old on 25 Feb 2026 and
 * exactly 2 months old on 14 Mar 2026 — the same arithmetic
 * `apps/mobile/src/utils/infantLogHelpers.ts` uses, ported to
 * `src/utils/functions/babyAgeWindow.ts` so the two can never disagree about "due".
 *
 * Run:  npx jest babyAgeReminders
 */
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

import { Types } from "mongoose";

import { clearTestDb, closeTestDb, connectTestDb } from "./helpers/db";
import { babyAgeReminders } from "../src/cron-jobs/babyAgeReminders";
import milestoneLogModel from "../src/models/milestone-log.model";
import UserModel from "../src/models/user.model";
import vaccinationLogModel from "../src/models/vaccination-log.model";
import { EChildOnboardingStatus, ESex, EVaccinationSector } from "../src/types/user.types";

jest.setTimeout(120000);

const DOB = "2026-01-14T06:00:00Z";
const SIX_WEEKS_OLD = new Date("2026-02-25T06:00:00Z");
const TWO_MONTHS_OLD = new Date("2026-03-14T06:00:00Z");

async function makeUserWithChild(
    overrides: { FCM_token?: string | null; sector?: EVaccinationSector } = {},
) {
    const childId = new Types.ObjectId();

    const user = await UserModel.create({
        phone_number: `9${Math.floor(100000000 + Math.random() * 899999999)}`,
        // `??` would treat an explicit `null` (the "no token" case a test asks for) as
        // absent and substitute the default anyway — "FCM_token" in overrides is checked
        // instead so passing `null` actually stores `null`.
        FCM_token: "FCM_token" in overrides ? overrides.FCM_token : "FCM_TOKEN_ONE",
        childs: [
            {
                _id: childId,
                name: "Aarav",
                date_of_birth: new Date(DOB),
                sex: ESex.MALE,
                onboarding_status: EChildOnboardingStatus.COMPLETED,
                vaccination_sector: overrides.sector ?? EVaccinationSector.PUBLIC,
            },
        ],
    });

    return { userId: user._id.toString(), childId: childId.toString() };
}

const dataOf = (i: number) => sendPushNotificationMock.mock.calls[i]?.[0] as {
    data: Record<string, string>;
};

/**
 * The public "birth" visit's doses. Its due window opens at day 0, so it is due (and, left
 * unlogged, keeps being due) from the very first run onward — every test below that wants
 * to isolate a later visit logs these first, the same way a parent would tick them off at
 * the hospital before the 6-week visit ever comes up.
 */
const PUBLIC_BIRTH_DOSES = ["bcg", "opv_birth", "hepatitis_b_birth"];
const PUBLIC_6W_DOSES = ["pentavalent_1", "opv_1", "rotavirus_rvv_1", "pcv_1", "fipv_ipv_1"];

const logDoses = (userId: string, childId: string, keys: string[], givenOn: Date) =>
    Promise.all(
        keys.map((vaccineKey) => vaccinationLogModel.create({ userId, childId, vaccineKey, givenOn })),
    );

beforeAll(connectTestDb);
afterAll(closeTestDb);
beforeEach(async () => {
    await clearTestDb();
    sendPushNotificationMock.mockClear();
});

describe("vaccination side", () => {
    it("sends VACCINATION_DUE once the 6-week visit is due and nothing is logged for it", async () => {
        const { userId, childId } = await makeUserWithChild();
        await logDoses(userId, childId, PUBLIC_BIRTH_DOSES, SIX_WEEKS_OLD);

        const result = await babyAgeReminders(SIX_WEEKS_OLD);

        expect(result.vaccinationRemindersSent).toBe(1);
        expect(sendPushNotificationMock).toHaveBeenCalledTimes(1);
        expect(dataOf(0).data).toEqual({ type: "VACCINATION_DUE", childId, visitKey: "6w" });

        const user = await UserModel.findById(userId).lean();
        const pending = user!.childs[0]!.pending_vaccination_reminders!;
        expect(pending.map((p) => p.visitKey)).toEqual(["6w"]);
    });

    it("does not send twice for the same day, even if the job runs again", async () => {
        const { userId, childId } = await makeUserWithChild();
        await logDoses(userId, childId, PUBLIC_BIRTH_DOSES, SIX_WEEKS_OLD);

        await babyAgeReminders(SIX_WEEKS_OLD);
        const second = await babyAgeReminders(SIX_WEEKS_OLD);

        expect(second.vaccinationRemindersSent).toBe(0);
        expect(sendPushNotificationMock).toHaveBeenCalledTimes(1);
    });

    it("does not re-send before the 7-day interval has passed", async () => {
        const { userId, childId } = await makeUserWithChild();
        await logDoses(userId, childId, PUBLIC_BIRTH_DOSES, SIX_WEEKS_OLD);

        await babyAgeReminders(SIX_WEEKS_OLD);
        const threeDaysLater = await babyAgeReminders(
            new Date(SIX_WEEKS_OLD.getTime() + 3 * 86_400_000),
        );

        expect(threeDaysLater.vaccinationRemindersSent).toBe(0);
        expect(sendPushNotificationMock).toHaveBeenCalledTimes(1);
    });

    it("re-sends once 7 days have passed and the visit is still unlogged", async () => {
        const { userId, childId } = await makeUserWithChild();
        await logDoses(userId, childId, PUBLIC_BIRTH_DOSES, SIX_WEEKS_OLD);

        await babyAgeReminders(SIX_WEEKS_OLD);
        const sevenDaysLater = await babyAgeReminders(
            new Date(SIX_WEEKS_OLD.getTime() + 7 * 86_400_000),
        );

        expect(sevenDaysLater.vaccinationRemindersSent).toBe(1);
        expect(sendPushNotificationMock).toHaveBeenCalledTimes(2);
    });

    it("stops reminding once every dose in the visit is logged", async () => {
        const { userId, childId } = await makeUserWithChild();
        await logDoses(userId, childId, PUBLIC_BIRTH_DOSES, SIX_WEEKS_OLD);
        await babyAgeReminders(SIX_WEEKS_OLD);
        sendPushNotificationMock.mockClear();

        await logDoses(userId, childId, PUBLIC_6W_DOSES, SIX_WEEKS_OLD);

        const sevenDaysLater = await babyAgeReminders(
            new Date(SIX_WEEKS_OLD.getTime() + 7 * 86_400_000),
        );

        expect(sevenDaysLater.vaccinationRemindersSent).toBe(0);
        expect(sendPushNotificationMock).not.toHaveBeenCalled();

        const user = await UserModel.findById(userId).lean();
        expect(user!.childs[0]!.pending_vaccination_reminders).toEqual([]);
    });

    it("does not fire before the visit is actually due", async () => {
        await makeUserWithChild();

        const fourWeeksOld = new Date("2026-02-11T06:00:00Z");
        const result = await babyAgeReminders(fourWeeksOld);

        // The birth visit (due at week 0) is due; 6w/10w/14w and beyond are not yet.
        expect(result.vaccinationRemindersSent).toBe(1);
        expect(dataOf(0).data.visitKey).toBe("birth");
    });

    it("skips a child with no FCM token but still tracks that the visit is due", async () => {
        const { userId } = await makeUserWithChild({ FCM_token: null });

        const result = await babyAgeReminders(SIX_WEEKS_OLD);

        expect(result.vaccinationRemindersSent).toBe(0);
        expect(sendPushNotificationMock).not.toHaveBeenCalled();

        const user = await UserModel.findById(userId).lean();
        expect(user!.childs[0]!.pending_vaccination_reminders!.map((p) => p.visitKey)).toEqual([
            "birth",
            "6w",
        ]);
    });

    it("uses the private schedule for a private-sector child", async () => {
        await makeUserWithChild({ sector: EVaccinationSector.PRIVATE });

        const result = await babyAgeReminders(SIX_WEEKS_OLD);

        // Private schedule also has a 6w visit (dtwp_dtap_1, ipv_1, hib_1, hepatitis_b_2,
        // pcv_1, rotavirus_rvv_1) plus the birth visit — same two as public, different doses.
        expect(result.vaccinationRemindersSent).toBe(2);
        expect([dataOf(0).data.visitKey, dataOf(1).data.visitKey].sort()).toEqual(["6w", "birth"]);
    });
});

describe("milestone side", () => {
    it("sends MILESTONE_DUE once the 2-3 month band is due and nothing is logged for it", async () => {
        const { userId, childId } = await makeUserWithChild();

        const result = await babyAgeReminders(TWO_MONTHS_OLD);

        // At two months old, the birth and 6w vaccination visits are independently due
        // too — find the milestone push by type rather than assuming it is the only one.
        expect(result.milestoneRemindersSent).toBe(1);
        const milestoneCall = sendPushNotificationMock.mock.calls
            .map(([arg]) => arg as { data: Record<string, string> })
            .find((call) => call.data.type === "MILESTONE_DUE");
        expect(milestoneCall?.data).toEqual({ type: "MILESTONE_DUE", childId, bandKey: "2-3m" });

        const user = await UserModel.findById(userId).lean();
        expect(user!.childs[0]!.pending_milestone_reminders!.map((p) => p.bandKey)).toEqual([
            "2-3m",
        ]);
    });

    it("stops reminding once every milestone in the band is logged", async () => {
        const { userId, childId } = await makeUserWithChild();
        await babyAgeReminders(TWO_MONTHS_OLD);
        sendPushNotificationMock.mockClear();

        for (const milestoneKey of [
            "begins_to_recognize_the_mothers_face",
            "develops_a_social_smile",
            "makes_eye_contact",
            "raises_head_at_times_when_on_tummy",
            "moves_both_arms_and_both_legs_when_excited",
            "keeps_hands_open_and_relaxed",
        ]) {
            await milestoneLogModel.create({ userId, childId, milestoneKey, achievedOn: TWO_MONTHS_OLD });
        }

        const sevenDaysLater = await babyAgeReminders(
            new Date(TWO_MONTHS_OLD.getTime() + 7 * 86_400_000),
        );

        expect(sevenDaysLater.milestoneRemindersSent).toBe(0);

        const user = await UserModel.findById(userId).lean();
        expect(user!.childs[0]!.pending_milestone_reminders).toEqual([]);
    });
});

describe("scan bounds", () => {
    it("does not count or crash on a child with no date of birth", async () => {
        const childId = new Types.ObjectId();
        await UserModel.create({
            phone_number: `9${Math.floor(100000000 + Math.random() * 899999999)}`,
            FCM_token: "tok",
            childs: [{ _id: childId, name: "Draft" }],
        });

        const result = await babyAgeReminders(SIX_WEEKS_OLD);

        expect(result.childrenScanned).toBe(0);
        expect(sendPushNotificationMock).not.toHaveBeenCalled();
    });

    it("counts every child with a date of birth across every user", async () => {
        await makeUserWithChild();
        await makeUserWithChild();

        const result = await babyAgeReminders(SIX_WEEKS_OLD);

        expect(result.childrenScanned).toBe(2);
    });
});
