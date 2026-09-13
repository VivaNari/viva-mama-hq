/**
 * Growth logs: persistence, ownership, and the percentiles stored alongside each entry.
 *
 * The reference-parity test here is duplicated on purpose — the same assertion lives in
 * `packages/growth-standards` and in the mobile suite. That duplication is the contract
 * between the two consumers: if the backend ever ships against a stale `dist` of the
 * standards package, this is what catches it, because the package's own suite would still
 * be passing against its source.
 */

jest.mock(require.resolve("../src/config/firebase"), () => ({ __esModule: true, default: null }));
jest.mock(require.resolve("../src/config/redis.config"), () => ({ __esModule: true }));
jest.mock("razorpay", () =>
    jest.fn().mockImplementation(() => ({ orders: { create: jest.fn() } })),
);

import { Response } from "express";
import { Types } from "mongoose";

import { STANDARD_VERSION } from "@vivamama/growth-standards";

import { clearTestDb, closeTestDb, connectTestDb } from "./helpers/db";
import GrowthLogController from "../src/api/v1/controllers/growth-log/growth-log.controller";
import { messages } from "../src/constants/messages";
import { formatDateToISO, getISTCalendarDate } from "../src/services/date/date.service";
import growthLogModel from "../src/models/growth-log.model";
import UserModel from "../src/models/user.model";
import { growthLogUpsertValidator } from "../src/api/v1/validators/growth-log/growth-log.validator";
import ChildService from "../src/services/childs/child.service";
import GrowthLogService, {
    ChildNotFoundError,
} from "../src/services/growth-log/growth-log.service";
import { EChildOnboardingStatus, ESex } from "../src/types/user.types";

jest.setTimeout(120000);

const service = new GrowthLogService();

/** A boy born 2026-03-14 with the birth measurements baby onboarding would have captured. */
async function createUserWithChild(
    overrides: { sex?: ESex; date_of_birth?: string; birth_measurements?: object } = {},
) {
    const childId = new Types.ObjectId();

    const user = await UserModel.create({
        phone_number: `9${Math.floor(100000000 + Math.random() * 899999999)}`,
        childs: [
            {
                _id: childId,
                name: "Aarav",
                date_of_birth: new Date(overrides.date_of_birth ?? "2026-03-14"),
                sex: overrides.sex ?? ESex.MALE,
                onboarding_status: EChildOnboardingStatus.COMPLETED,
                birth_measurements: overrides.birth_measurements ?? {
                    weight_grams: 3300,
                    length_cm: 50,
                    head_circumference_cm: 34.5,
                },
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

describe("reference parity with infantchart.com", () => {
    /**
     * Boy, born 2026-03-14, measured 2026-09-13 (183 days), 7.80 kg.
     * The reference site reports percentile rank 43.6.
     */
    it("persists the same percentile the reference implementation reports", async () => {
        const { userId, childId } = await createUserWithChild();

        const entry = await service.upsertForDate({
            userId,
            childId,
            measuredOn: new Date("2026-09-13T00:00:00.000Z"),
            measurement: { weight_kg: 7.8 },
        });

        expect(entry.ageInDays).toBe(183);
        expect(entry.percentiles.weight_for_age.status).toBe("OK");
        expect(entry.percentiles.weight_for_age.z).toBeCloseTo(-0.1604, 4);
        expect(entry.percentiles.weight_for_age.percentile).toBeCloseTo(43.6, 1);
    });

    it("stamps the standard version onto every row", async () => {
        const { userId, childId } = await createUserWithChild();

        const entry = await service.upsertForDate({
            userId,
            childId,
            measuredOn: new Date("2026-09-13T00:00:00.000Z"),
            measurement: { weight_kg: 7.8 },
        });

        expect(entry.standard.source).toBe("WHO-2006");
        expect(entry.standard.version).toBe(STANDARD_VERSION);
    });
});

describe("upsertForDate", () => {
    it("scores all four indicators from one entry", async () => {
        const { userId, childId } = await createUserWithChild();

        const entry = await service.upsertForDate({
            userId,
            childId,
            measuredOn: new Date("2026-09-13T00:00:00.000Z"),
            measurement: { weight_kg: 7.8, length_cm: 67.6, head_circumference_cm: 43.3 },
        });

        expect(entry.percentiles.weight_for_age.status).toBe("OK");
        expect(entry.percentiles.length_for_age.status).toBe("OK");
        expect(entry.percentiles.head_circumference_for_age.status).toBe("OK");
        expect(entry.percentiles.weight_for_length.status).toBe("OK");
    });

    /** One editable log per child per day — the rule the unique index backs. */
    it("updates the existing row rather than adding a second for the same day", async () => {
        const { userId, childId } = await createUserWithChild();
        const measuredOn = new Date("2026-09-13T00:00:00.000Z");

        const first = await service.upsertForDate({
            userId,
            childId,
            measuredOn,
            measurement: { weight_kg: 7.8 },
        });

        const corrected = await service.upsertForDate({
            userId,
            childId,
            measuredOn,
            measurement: { weight_kg: 8.1 },
        });

        expect(corrected._id.toString()).toBe(first._id.toString());
        expect(await growthLogModel.countDocuments({ userId, childId })).toBe(1);
        expect(corrected.measurements.weight_kg).toBe(8.1);
        expect(corrected.percentiles.weight_for_age.percentile).not.toBeCloseTo(43.6, 1);
    });

    it("keeps separate days apart", async () => {
        const { userId, childId } = await createUserWithChild();

        await service.upsertForDate({
            userId,
            childId,
            measuredOn: new Date("2026-09-12T00:00:00.000Z"),
            measurement: { weight_kg: 7.7 },
        });
        await service.upsertForDate({
            userId,
            childId,
            measuredOn: new Date("2026-09-13T00:00:00.000Z"),
            measurement: { weight_kg: 7.8 },
        });

        expect(await growthLogModel.countDocuments({ userId, childId })).toBe(2);
    });

    /**
     * Weight-for-length needs both numbers from the same entry. It is recorded as
     * MISSING_INPUT rather than omitted, so the UI has something definite to explain.
     */
    it("records why an indicator could not be scored", async () => {
        const { userId, childId } = await createUserWithChild();

        const entry = await service.upsertForDate({
            userId,
            childId,
            measuredOn: new Date("2026-09-13T00:00:00.000Z"),
            measurement: { weight_kg: 7.8 },
        });

        expect(entry.percentiles.weight_for_length.status).toBe("MISSING_INPUT");
        expect(entry.percentiles.weight_for_length.percentile).toBeNull();
    });
});

describe("ownership", () => {
    it("refuses a child that belongs to someone else", async () => {
        const mine = await createUserWithChild();
        const theirs = await createUserWithChild();

        await expect(
            service.upsertForDate({
                userId: mine.userId,
                childId: theirs.childId,
                measuredOn: new Date("2026-09-13T00:00:00.000Z"),
                measurement: { weight_kg: 7.8 },
            }),
        ).rejects.toBeInstanceOf(ChildNotFoundError);

        expect(await growthLogModel.countDocuments()).toBe(0);
    });

    it("refuses a childId that is not an ObjectId at all", async () => {
        const { userId } = await createUserWithChild();

        await expect(
            service.listForChild({ userId, childId: "not-an-id" }),
        ).rejects.toBeInstanceOf(ChildNotFoundError);
    });
});

describe("listForChild", () => {
    it("returns the history oldest first, which is the order a chart plots", async () => {
        const { userId, childId } = await createUserWithChild();

        for (const day of ["2026-09-13", "2026-07-01", "2026-08-05"]) {
            await service.upsertForDate({
                userId,
                childId,
                measuredOn: new Date(`${day}T00:00:00.000Z`),
                measurement: { weight_kg: 7 },
            });
        }

        const logs = await service.listForChild({ userId, childId });

        expect(logs.map((entry) => entry.measuredOn.toISOString().slice(0, 10))).toEqual([
            "2026-07-01",
            "2026-08-05",
            "2026-09-13",
        ]);
    });

    it("honours a date window", async () => {
        const { userId, childId } = await createUserWithChild();

        for (const day of ["2026-07-01", "2026-08-05", "2026-09-13"]) {
            await service.upsertForDate({
                userId,
                childId,
                measuredOn: new Date(`${day}T00:00:00.000Z`),
                measurement: { weight_kg: 7 },
            });
        }

        const logs = await service.listForChild({
            userId,
            childId,
            from: new Date("2026-08-01T00:00:00.000Z"),
        });

        expect(logs).toHaveLength(2);
    });
});

describe("recordBirthMeasurements", () => {
    /** What gives a newly onboarded child a point on the chart before any manual log. */
    it("writes a day-0 entry from the birth measurements", async () => {
        const { userId, childId } = await createUserWithChild();

        const entry = await service.recordBirthMeasurements(userId, childId);

        expect(entry).not.toBeNull();
        expect(entry!.ageInDays).toBe(0);
        // 3300 g stored as kilograms — WHO's unit, converted once in the package.
        expect(entry!.measurements.weight_kg).toBeCloseTo(3.3, 6);
        expect(entry!.percentiles.weight_for_age.status).toBe("OK");
        expect(entry!.percentiles.weight_for_length.status).toBe("OK");
    });

    /** Re-completing an onboarding must not collide with the unique index. */
    it("is safe to run twice", async () => {
        const { userId, childId } = await createUserWithChild();

        await service.recordBirthMeasurements(userId, childId);
        await service.recordBirthMeasurements(userId, childId);

        expect(await growthLogModel.countDocuments({ userId, childId })).toBe(1);
    });

    it("records nothing when no birth measurements were captured", async () => {
        const { userId, childId } = await createUserWithChild({ birth_measurements: {} });

        expect(await service.recordBirthMeasurements(userId, childId)).toBeNull();
        expect(await growthLogModel.countDocuments()).toBe(0);
    });
});

describe("recomputeForChild", () => {
    /**
     * A percentile is only meaningful against the right birthday. A mother who fixes a
     * typo'd date would otherwise keep numbers computed against the wrong age forever —
     * and a stale percentile looks exactly as plausible as a correct one.
     */
    it("rescores stored history after the date of birth is corrected", async () => {
        const { userId, childId } = await createUserWithChild();
        const measuredOn = new Date("2026-09-13T00:00:00.000Z");

        const before = await service.upsertForDate({
            userId,
            childId,
            measuredOn,
            measurement: { weight_kg: 7.8 },
        });
        expect(before.ageInDays).toBe(183);

        // Born a month earlier than first recorded: the same weight now belongs to an
        // older baby, so the percentile must fall.
        await new ChildService().updateChild({
            userId,
            childId,
            date_of_birth: "2026-02-14",
        });

        const after = await growthLogModel.findById(before._id).lean();

        expect(after!.ageInDays).toBe(211);
        expect(after!.percentiles.weight_for_age.percentile).toBeLessThan(
            before.percentiles.weight_for_age.percentile!,
        );
    });

    it("rescores against the girls' tables when the sex is corrected", async () => {
        const { userId, childId } = await createUserWithChild();
        const measuredOn = new Date("2026-09-13T00:00:00.000Z");

        const before = await service.upsertForDate({
            userId,
            childId,
            measuredOn,
            measurement: { weight_kg: 7.8 },
        });

        await new ChildService().updateChild({ userId, childId, sex: ESex.FEMALE });

        const after = await growthLogModel.findById(before._id).lean();

        expect(after!.sex).toBe("Female");
        // Girls are lighter at six months, so the same weight scores higher.
        expect(after!.percentiles.weight_for_age.percentile).toBeGreaterThan(
            before.percentiles.weight_for_age.percentile!,
        );
    });

    /** Renaming a child says nothing about its measurements. */
    it("leaves percentiles alone when only the name changes", async () => {
        const { userId, childId } = await createUserWithChild();

        const before = await service.upsertForDate({
            userId,
            childId,
            measuredOn: new Date("2026-09-13T00:00:00.000Z"),
            measurement: { weight_kg: 7.8 },
        });

        await new ChildService().updateChild({ userId, childId, name: "Arjun" });

        const after = await growthLogModel.findById(before._id).lean();

        expect(after!.updatedAt.getTime()).toBe(before.updatedAt.getTime());
    });
});

describe("upsert validation", () => {
    /**
     * The app always sends all three measurement keys, nulling the ones left blank — so a
     * guard built on Joi's `.or()` never fired for the real client, because `.or()` treats
     * an explicit null as present. A field holding unparseable text ("abc" parses to null)
     * would then create a row whose four indicators were all MISSING_INPUT.
     */
    it("rejects a payload whose measurements are all null", () => {
        const { error } = growthLogUpsertValidator.validate({
            childId: new Types.ObjectId().toHexString(),
            measuredOn: "2026-09-13",
            weight_kg: null,
            length_cm: null,
            head_circumference_cm: null,
        });

        expect(error?.message).toContain("at least one of");
    });

    it("accepts a single measurement alongside nulls", () => {
        const { error } = growthLogUpsertValidator.validate({
            childId: new Types.ObjectId().toHexString(),
            measuredOn: "2026-09-13",
            weight_kg: null,
            length_cm: 67.6,
            head_circumference_cm: null,
        });

        expect(error).toBeUndefined();
    });

    it("rejects a weight that is obviously the wrong unit", () => {
        // 7800 would be grams typed into a kilogram field.
        const { error } = growthLogUpsertValidator.validate({
            childId: new Types.ObjectId().toHexString(),
            measuredOn: "2026-09-13",
            weight_kg: 7800,
        });

        expect(error).toBeDefined();
    });
});

describe("the editable-day rule", () => {
    /**
     * Today's entry is editable until the IST day ends; earlier days are closed.
     *
     * Enforced on the controller rather than only in the app, where it was decoration —
     * the UI hid the Save button on a past day but the endpoint accepted any past date, so
     * the rule held only for as long as nobody called the API directly. These tests drive
     * the controller, because that boundary is where the rule lives.
     */
    const respond = () => {
        const res: Record<string, unknown> = {};
        res.status = jest.fn().mockReturnValue(res);
        res.json = jest.fn().mockReturnValue(res);
        return res as unknown as Response & {
            status: jest.Mock;
            json: jest.Mock;
        };
    };

    const post = async (userId: string, body: object) => {
        const controller = new GrowthLogController();
        const res = respond();
        await controller.createOrUpdateGrowthLog(
            { body, user: { _id: userId } } as never,
            res,
            jest.fn() as never,
        );
        return res;
    };

    const todayKey = () => formatDateToISO(getISTCalendarDate());

    it("accepts today", async () => {
        const { userId, childId } = await createUserWithChild();

        const res = await post(userId, {
            childId,
            measuredOn: todayKey(),
            weight_kg: 7.8,
        });

        expect(res.status).toHaveBeenCalledWith(200);
        expect(await growthLogModel.countDocuments({ userId })).toBe(1);
    });

    it("refuses to write a day that has closed", async () => {
        const { userId, childId } = await createUserWithChild();

        const yesterday = new Date(getISTCalendarDate().getTime() - 86_400_000);
        const res = await post(userId, {
            childId,
            measuredOn: formatDateToISO(yesterday),
            weight_kg: 7.8,
        });

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({ message: messages.GROWTH_LOG_DAY_CLOSED }),
        );
        expect(await growthLogModel.countDocuments({ userId })).toBe(0);
    });

    /**
     * The rule belongs to the HTTP boundary, not the service: the day-0 entry written when
     * baby onboarding completes is dated the child's birthday, and a recompute after a
     * corrected date of birth rewrites historical rows. Both must keep working.
     */
    it("does not block the day-0 entry written at onboarding", async () => {
        const { userId, childId } = await createUserWithChild();

        const entry = await service.recordBirthMeasurements(userId, childId);

        expect(entry).not.toBeNull();
        expect(entry!.ageInDays).toBe(0);
    });

    it("does not block a recompute of historical rows", async () => {
        const { userId, childId } = await createUserWithChild();
        await service.recordBirthMeasurements(userId, childId);

        await expect(service.recomputeForChild(userId, childId)).resolves.toBe(1);
    });
});
