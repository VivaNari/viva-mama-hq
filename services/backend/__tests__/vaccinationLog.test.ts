/**
 * Vaccination logs: the schedule guard, the upsert, and the rules on the HTTP boundary.
 *
 * The shape mirrors the milestone log rather than the growth or diaper one, because a dose
 * is like a milestone and unlike a day: it happens once, the key *is* the dose, and the date
 * is an attribute. So re-recording corrects a date rather than adding a row, and there is no
 * closed-day rule to enforce.
 *
 * The one thing here that has no milestone equivalent is the shared key space. Both
 * schedules reach BCG-at-birth through the same key, deliberately, so that a family which
 * switches sector keeps the ticks that genuinely carry over — and that is asserted below,
 * because it is a decision rather than an accident and an innocent-looking regeneration
 * could undo it.
 *
 * Run:  npx jest vaccinationLog
 */

jest.mock(require.resolve("../src/config/firebase"), () => ({ __esModule: true, default: null }));
jest.mock(require.resolve("../src/config/redis.config"), () => ({ __esModule: true }));
jest.mock("razorpay", () =>
    jest.fn().mockImplementation(() => ({ orders: { create: jest.fn() } })),
);

import { Response } from "express";
import { Types } from "mongoose";

import { clearTestDb, closeTestDb, connectTestDb } from "./helpers/db";
import VaccinationLogController from "../src/api/v1/controllers/vaccination-log/vaccination-log.controller";
import { vaccinationLogRecordValidator } from "../src/api/v1/validators/vaccination-log/vaccination-log.validator";
import { messages } from "../src/constants/messages";
import { VACCINE_KEYS, isVaccineKey } from "../src/constants/vaccine-keys";
import UserModel from "../src/models/user.model";
import vaccinationLogModel from "../src/models/vaccination-log.model";
import ChildService from "../src/services/childs/child.service";
import { formatDateToISO, getISTCalendarDate } from "../src/services/date/date.service";
import VaccinationLogService, {
    ChildNotFoundError,
} from "../src/services/vaccination-log/vaccination-log.service";
import { EChildOnboardingStatus, ESex } from "../src/types/user.types";

jest.setTimeout(120000);

const service = new VaccinationLogService();

const BCG = "bcg";
const PENTA_1 = "pentavalent_1";

async function createUserWithChild(overrides: { date_of_birth?: string } = {}) {
    const childId = new Types.ObjectId();

    const user = await UserModel.create({
        phone_number: `9${Math.floor(100000000 + Math.random() * 899999999)}`,
        childs: [
            {
                _id: childId,
                name: "Aarav",
                date_of_birth: new Date(overrides.date_of_birth ?? "2026-03-14"),
                sex: ESex.MALE,
                onboarding_status: EChildOnboardingStatus.COMPLETED,
            },
        ],
    });

    return { userId: user._id.toString(), childId: childId.toString() };
}

beforeAll(async () => {
    await connectTestDb();
});

afterAll(async () => {
    await closeTestDb();
});

beforeEach(async () => {
    await clearTestDb();
});

describe("the generated schedule", () => {
    /**
     * Fixed here so that a regeneration which silently dropped rows fails on the API side
     * too, rather than shipping a validator that rejects doses the app still renders.
     *
     * 48, not the sheet's 30 rows: the workbook carries only the government schedule and
     * only through 16 years, while this list is the government schedule through two years
     * plus the private one from the generator's own IAP table, with the doses they share
     * counted once.
     */
    it("carries every dose the app ships", () => {
        expect(VACCINE_KEYS).toHaveLength(48);
        expect(new Set(VACCINE_KEYS).size).toBe(48);
    });

    /**
     * The doses beyond two years are excluded in the generator, so they must not be keys the
     * API will accept. Otherwise a stale client could store a row that no screen can ever
     * show, which is the exact thing validating against this list is for.
     */
    it("rejects the doses beyond two years", () => {
        // Vitamin A's 3rd-9th doses, the second DPT booster and both Td boosters.
        for (const key of ["vitamin_a_3", "dpt_booster_2", "td_tt", "td"]) {
            expect(isVaccineKey(key)).toBe(false);
        }
    });

    /**
     * A key names the dose, not the sector. Both schedules put BCG at birth, and both reach
     * it through the same row — so a family that switches sector does not lose it.
     *
     * The counterpart matters just as much: Pentavalent and DTwP are different products, so
     * they do *not* share a key and the tick does not carry over. Mapping between them is a
     * clinical question, and silently answering it here would tell a parent a dose had been
     * given when it had not.
     */
    it("shares a key where the two schedules give the same dose, and only there", () => {
        for (const shared of ["bcg", "opv_birth", "hepatitis_b_birth", "pcv_1", "pcv_booster"]) {
            expect(isVaccineKey(shared)).toBe(true);
        }

        expect(isVaccineKey("pentavalent_1")).toBe(true);
        expect(isVaccineKey("dtwp_dtap_1")).toBe(true);
        expect(PENTA_1).not.toBe("dtwp_dtap_1");
    });

    it("recognises its own keys and nothing else", () => {
        expect(isVaccineKey(BCG)).toBe(true);
        expect(isVaccineKey("unicorn_serum")).toBe(false);
        expect(isVaccineKey(undefined)).toBe(false);
    });
});

describe("record", () => {
    it("records a dose against the child", async () => {
        const { userId, childId } = await createUserWithChild();

        const entry = await service.record({
            userId,
            childId,
            vaccineKey: BCG,
            givenOn: new Date("2026-03-14"),
        });

        expect(entry.vaccineKey).toBe(BCG);
        expect(await vaccinationLogModel.countDocuments({ userId, childId })).toBe(1);
    });

    /** The unique index is on the dose, so a second write has to be a correction. */
    it("corrects the date rather than adding a second row", async () => {
        const { userId, childId } = await createUserWithChild();

        await service.record({ userId, childId, vaccineKey: BCG, givenOn: new Date("2026-03-14") });
        const corrected = await service.record({
            userId,
            childId,
            vaccineKey: BCG,
            givenOn: new Date("2026-03-15"),
        });

        expect(await vaccinationLogModel.countDocuments({ userId, childId })).toBe(1);
        expect(formatDateToISO(corrected.givenOn)).toBe("2026-03-15");
    });

    it("keeps different doses of the same vaccine apart", async () => {
        const { userId, childId } = await createUserWithChild();

        await service.record({ userId, childId, vaccineKey: PENTA_1, givenOn: new Date() });
        await service.record({ userId, childId, vaccineKey: "pentavalent_2", givenOn: new Date() });

        expect(await vaccinationLogModel.countDocuments({ userId, childId })).toBe(2);
    });

    it("refuses a child that does not belong to the caller", async () => {
        const mine = await createUserWithChild();
        const theirs = await createUserWithChild();

        await expect(
            service.record({
                userId: mine.userId,
                childId: theirs.childId,
                vaccineKey: BCG,
                givenOn: new Date(),
            }),
        ).rejects.toBeInstanceOf(ChildNotFoundError);

        expect(await vaccinationLogModel.countDocuments({})).toBe(0);
    });

    /**
     * The enum is the last line of defence, behind the validator. It matters because the
     * service is reachable from anywhere in the process, not only through the route.
     */
    it("rejects a key outside the schedule at the schema", async () => {
        const { userId, childId } = await createUserWithChild();

        await expect(
            vaccinationLogModel.create({
                userId,
                childId,
                vaccineKey: "unicorn_serum",
                givenOn: new Date(),
            }),
        ).rejects.toThrow();
    });
});

describe("remove", () => {
    it("removes a recorded dose", async () => {
        const { userId, childId } = await createUserWithChild();
        await service.record({ userId, childId, vaccineKey: BCG, givenOn: new Date() });

        expect(await service.remove({ userId, childId, vaccineKey: BCG })).toBe(true);
        expect(await vaccinationLogModel.countDocuments({ userId, childId })).toBe(0);
    });

    it("reports nothing removed for a dose that was never recorded", async () => {
        const { userId, childId } = await createUserWithChild();

        expect(await service.remove({ userId, childId, vaccineKey: BCG })).toBe(false);
    });

    it("will not remove another user's dose", async () => {
        const mine = await createUserWithChild();
        const theirs = await createUserWithChild();
        await service.record({
            userId: theirs.userId,
            childId: theirs.childId,
            vaccineKey: BCG,
            givenOn: new Date(),
        });

        await expect(
            service.remove({ userId: mine.userId, childId: theirs.childId, vaccineKey: BCG }),
        ).rejects.toBeInstanceOf(ChildNotFoundError);

        expect(await vaccinationLogModel.countDocuments({})).toBe(1);
    });
});

describe("listForChild", () => {
    it("returns the whole card for the child, and nobody else's", async () => {
        const mine = await createUserWithChild();
        const theirs = await createUserWithChild();

        await service.record({ ...mine, vaccineKey: BCG, givenOn: new Date("2026-03-14") });
        await service.record({ ...mine, vaccineKey: PENTA_1, givenOn: new Date("2026-04-25") });
        await service.record({ ...theirs, vaccineKey: BCG, givenOn: new Date("2026-03-14") });

        const logs = await service.listForChild(mine.userId, mine.childId);

        expect(logs.map((entry) => entry.vaccineKey)).toEqual([BCG, PENTA_1]);
    });
});

describe("the HTTP boundary", () => {
    const respond = () => {
        const res: Record<string, unknown> = {};
        res.status = jest.fn().mockReturnValue(res);
        res.json = jest.fn().mockReturnValue(res);
        return res as unknown as Response & { status: jest.Mock; json: jest.Mock };
    };

    const post = async (userId: string, body: object) => {
        const controller = new VaccinationLogController();
        const res = respond();
        await controller.recordDose(
            { body, user: { _id: userId } } as never,
            res,
            jest.fn() as never,
        );
        return res;
    };

    const message = (res: { json: jest.Mock }) => res.json.mock.calls[0][0].message;

    it("defaults an undated dose to today", async () => {
        const { userId, childId } = await createUserWithChild();

        const res = await post(userId, { childId, vaccineKey: PENTA_1 });

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json.mock.calls[0][0].data.givenOn).toBe(
            formatDateToISO(getISTCalendarDate()),
        );
    });

    /**
     * Back-dating is the normal case, not a correction: a parent copies the clinic card in
     * one sitting and most of what they enter happened weeks ago.
     */
    it("accepts a past date", async () => {
        const { userId, childId } = await createUserWithChild({ date_of_birth: "2026-03-14" });

        const res = await post(userId, {
            childId,
            vaccineKey: PENTA_1,
            givenOn: "2026-04-25",
        });

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json.mock.calls[0][0].data.givenOn).toBe("2026-04-25");
    });

    it("refuses a future date", async () => {
        const { userId, childId } = await createUserWithChild();
        const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);

        const res = await post(userId, {
            childId,
            vaccineKey: PENTA_1,
            givenOn: formatDateToISO(tomorrow),
        });

        expect(res.status).toHaveBeenCalledWith(400);
        expect(message(res)).toBe(messages.VACCINATION_LOG_FUTURE_NOT_ALLOWED);
        expect(await vaccinationLogModel.countDocuments({})).toBe(0);
    });

    it("refuses a date before the child was born", async () => {
        const { userId, childId } = await createUserWithChild({ date_of_birth: "2026-03-14" });

        const res = await post(userId, { childId, vaccineKey: BCG, givenOn: "2026-03-13" });

        expect(res.status).toHaveBeenCalledWith(400);
        expect(message(res)).toBe(messages.VACCINATION_LOG_BEFORE_BIRTH);
    });

    /**
     * The birth dose is given within 24 hours of delivery, so the birthday itself has to be
     * accepted. An exclusive bound would reject the three doses every child gets first.
     */
    it("accepts the birthday itself, which is when the birth doses are given", async () => {
        const { userId, childId } = await createUserWithChild({ date_of_birth: "2026-03-14" });

        const res = await post(userId, { childId, vaccineKey: BCG, givenOn: "2026-03-14" });

        expect(res.status).toHaveBeenCalledWith(200);
    });

    it("reports another user's child as not found", async () => {
        const mine = await createUserWithChild();
        const theirs = await createUserWithChild();

        const res = await post(mine.userId, { childId: theirs.childId, vaccineKey: BCG });

        expect(res.status).toHaveBeenCalledWith(404);
        expect(message(res)).toBe(messages.VACCINATION_LOG_CHILD_NOT_FOUND);
    });

    it("reports a dose that was never recorded as not found on delete", async () => {
        const { userId, childId } = await createUserWithChild();
        const controller = new VaccinationLogController();
        const res = respond();

        await controller.removeDose(
            { body: { childId, vaccineKey: BCG }, user: { _id: userId } } as never,
            res,
            jest.fn() as never,
        );

        expect(res.status).toHaveBeenCalledWith(404);
        expect(message(res)).toBe(messages.VACCINATION_LOG_NOT_FOUND);
    });
});

describe("the record validator", () => {
    const body = (overrides: object = {}) => ({
        childId: new Types.ObjectId().toString(),
        vaccineKey: BCG,
        ...overrides,
    });

    it("accepts every key in the schedule", () => {
        for (const key of VACCINE_KEYS) {
            expect(
                vaccinationLogRecordValidator.validate(body({ vaccineKey: key })).error,
            ).toBeUndefined();
        }
    });

    it("rejects a key outside the schedule", () => {
        expect(
            vaccinationLogRecordValidator.validate(body({ vaccineKey: "unicorn_serum" })).error,
        ).toBeDefined();
    });

    it("treats givenOn as optional, and rejects a malformed one", () => {
        expect(vaccinationLogRecordValidator.validate(body()).error).toBeUndefined();
        expect(
            vaccinationLogRecordValidator.validate(body({ givenOn: "25-04-2026" })).error,
        ).toBeDefined();
    });
});

describe("child deletion", () => {
    it("takes the child's vaccination card with it", async () => {
        const { userId, childId } = await createUserWithChild();
        await service.record({ userId, childId, vaccineKey: BCG, givenOn: new Date() });

        await new ChildService().deleteChild(userId, childId);

        expect(await vaccinationLogModel.countDocuments({ userId, childId })).toBe(0);
    });
});
