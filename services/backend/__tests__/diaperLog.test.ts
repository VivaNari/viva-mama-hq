/**
 * Diaper logs: the day document, the append path, and the rules on the HTTP boundary.
 *
 * The thing under test that is not obvious from the code is concurrency. This screen is
 * tapped repeatedly and fast — one-handed, at 3am — so "two entries recorded a moment
 * apart both survive" is the correctness property that matters most, and the one a
 * read-modify-write implementation would quietly fail.
 */

jest.mock(require.resolve("../src/config/firebase"), () => ({ __esModule: true, default: null }));
jest.mock(require.resolve("../src/config/redis.config"), () => ({ __esModule: true }));
jest.mock("razorpay", () =>
    jest.fn().mockImplementation(() => ({ orders: { create: jest.fn() } })),
);

import { Response } from "express";
import { Types } from "mongoose";

import { clearTestDb, closeTestDb, connectTestDb } from "./helpers/db";
import DiaperLogController from "../src/api/v1/controllers/diaper-log/diaper-log.controller";
import { diaperLogCreateValidator } from "../src/api/v1/validators/diaper-log/diaper-log.validator";
import { messages } from "../src/constants/messages";
import diaperLogModel from "../src/models/diaper-log.model";
import UserModel from "../src/models/user.model";
import ChildService from "../src/services/childs/child.service";
import { formatDateToISO, getISTCalendarDate } from "../src/services/date/date.service";
import DiaperLogService, {
    ChildNotFoundError,
    totalsFor,
} from "../src/services/diaper-log/diaper-log.service";
import { IDiaperEntry } from "../src/types/diaper-log.types";
import { EChildOnboardingStatus, ESex } from "../src/types/user.types";

jest.setTimeout(120000);

const service = new DiaperLogService();

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

describe("addEntry", () => {
    it("creates the day document on the first change of the day", async () => {
        const { userId, childId } = await createUserWithChild();

        const result = await service.addEntry({
            userId,
            childId,
            kind: "wet",
            loggedAt: new Date(),
        });

        expect(result.totals).toEqual({ wet: 1, dirty: 0, both: 0, total: 1 });
        expect(await diaperLogModel.countDocuments({ userId, childId })).toBe(1);
    });

    it("appends to the same day rather than creating a second document", async () => {
        const { userId, childId } = await createUserWithChild();

        await service.addEntry({ userId, childId, kind: "wet", loggedAt: new Date() });
        const second = await service.addEntry({
            userId,
            childId,
            kind: "dirty",
            loggedAt: new Date(),
        });

        expect(second.totals).toEqual({ wet: 1, dirty: 1, both: 0, total: 2 });
        expect(await diaperLogModel.countDocuments({ userId, childId })).toBe(1);
    });

    /**
     * Two diapers a minute apart is a real thing that happens, so duplicates are not an
     * error to be deduplicated — both must survive with their own ids.
     */
    it("keeps two changes of the same kind at almost the same time", async () => {
        const { userId, childId } = await createUserWithChild();

        const first = await service.addEntry({
            userId,
            childId,
            kind: "wet",
            loggedAt: new Date(),
        });
        const second = await service.addEntry({
            userId,
            childId,
            kind: "wet",
            loggedAt: new Date(),
        });

        expect(second.totals.wet).toBe(2);
        expect(first.entry._id.toString()).not.toBe(second.entry._id.toString());
    });

    /**
     * The reason the write is a `$push` inside an upsert rather than a read, append and
     * write back. Concurrent taps on a day with no document yet both race the insert; the
     * unique index lets one through and the loser retries into the winner's document.
     *
     * A read-modify-write implementation passes every test above and fails this one.
     */
    it("loses no entry when several taps land at once", async () => {
        const { userId, childId } = await createUserWithChild();

        await Promise.all(
            Array.from({ length: 8 }, () =>
                service.addEntry({ userId, childId, kind: "wet", loggedAt: new Date() }),
            ),
        );

        const documents = await diaperLogModel.find({ userId, childId }).lean();

        expect(documents).toHaveLength(1);
        expect(documents[0]?.entries).toHaveLength(8);
    });

    it("refuses a child that does not belong to the caller", async () => {
        const mine = await createUserWithChild();
        const theirs = await createUserWithChild();

        await expect(
            service.addEntry({
                userId: mine.userId,
                childId: theirs.childId,
                kind: "wet",
                loggedAt: new Date(),
            }),
        ).rejects.toBeInstanceOf(ChildNotFoundError);
    });
});

describe("removeEntry", () => {
    it("removes one entry and leaves the rest of the day", async () => {
        const { userId, childId } = await createUserWithChild();
        const loggedOn = getISTCalendarDate();

        const first = await service.addEntry({
            userId,
            childId,
            kind: "wet",
            loggedAt: new Date(),
        });
        await service.addEntry({ userId, childId, kind: "dirty", loggedAt: new Date() });

        const result = await service.removeEntry({
            userId,
            childId,
            loggedOn,
            entryId: first.entry._id.toString(),
        });

        expect(result.removed).toBe(true);
        expect(result.totals).toEqual({ wet: 0, dirty: 1, both: 0, total: 1 });
    });

    it("reports nothing removed for an id that is not there", async () => {
        const { userId, childId } = await createUserWithChild();
        await service.addEntry({ userId, childId, kind: "wet", loggedAt: new Date() });

        const result = await service.removeEntry({
            userId,
            childId,
            loggedOn: getISTCalendarDate(),
            entryId: new Types.ObjectId().toString(),
        });

        expect(result.removed).toBe(false);
    });

    /**
     * The entry id alone must not be enough. Scoping the `$pull` by user and child in the
     * same filter is what stops one account deleting from another's day.
     */
    it("will not remove another user's entry given its id", async () => {
        const mine = await createUserWithChild();
        const theirs = await createUserWithChild();

        const victim = await service.addEntry({
            userId: theirs.userId,
            childId: theirs.childId,
            kind: "wet",
            loggedAt: new Date(),
        });

        await expect(
            service.removeEntry({
                userId: mine.userId,
                childId: theirs.childId,
                loggedOn: getISTCalendarDate(),
                entryId: victim.entry._id.toString(),
            }),
        ).rejects.toBeInstanceOf(ChildNotFoundError);

        const day = await diaperLogModel.findOne({ userId: theirs.userId }).lean();
        expect(day?.entries).toHaveLength(1);
    });
});

describe("IST day bucketing", () => {
    /**
     * The server derives the day from the instant, so a phone in another timezone cannot
     * file an entry against a day the server reads differently.
     *
     * 18:20 UTC is 23:50 IST on the same date; 18:40 UTC is 00:10 IST on the next one. Two
     * changes twenty minutes apart therefore belong to different days, and a naive UTC
     * bucketing would put them both on the earlier one.
     */
    it("splits two changes either side of IST midnight into different days", async () => {
        const { userId, childId } = await createUserWithChild();

        const beforeMidnight = new Date("2026-09-12T18:20:00.000Z");
        const afterMidnight = new Date("2026-09-12T18:40:00.000Z");

        await service.addEntry({ userId, childId, kind: "wet", loggedAt: beforeMidnight });
        await service.addEntry({ userId, childId, kind: "wet", loggedAt: afterMidnight });

        const days = await diaperLogModel.find({ userId, childId }).sort({ loggedOn: 1 }).lean();

        expect(days).toHaveLength(2);
        expect(formatDateToISO(days[0]!.loggedOn)).toBe("2026-09-12");
        expect(formatDateToISO(days[1]!.loggedOn)).toBe("2026-09-13");
    });
});

describe("totalsFor", () => {
    const entry = (kind: "wet" | "dirty" | "both") =>
        ({ _id: new Types.ObjectId(), kind, loggedAt: new Date() }) as unknown as IDiaperEntry;

    it("counts each kind separately and sums them", () => {
        expect(totalsFor([entry("wet"), entry("wet"), entry("dirty"), entry("both")])).toEqual({
            wet: 2,
            dirty: 1,
            both: 1,
            total: 4,
        });
    });

    /** "Both" counts once towards the total, not once as wet and once as dirty. */
    it("does not double-count a both", () => {
        expect(totalsFor([entry("both")])).toEqual({
            wet: 0,
            dirty: 0,
            both: 1,
            total: 1,
        });
    });

    it("reports zeroes for a day with nothing logged", () => {
        expect(totalsFor([])).toEqual({ wet: 0, dirty: 0, both: 0, total: 0 });
    });
});

describe("the editable-day rule", () => {
    /**
     * Today's entries are editable until the IST day ends; earlier days are closed. The
     * rule lives on the controller rather than only in the app — the UI hides the quick-log
     * tiles on a past day, but without this the endpoint would take any past instant and
     * the rule would hold only until somebody called the API directly.
     */
    const respond = () => {
        const res: Record<string, unknown> = {};
        res.status = jest.fn().mockReturnValue(res);
        res.json = jest.fn().mockReturnValue(res);
        return res as unknown as Response & { status: jest.Mock; json: jest.Mock };
    };

    const post = async (userId: string, body: object) => {
        const controller = new DiaperLogController();
        const res = respond();
        await controller.createDiaperLogEntry(
            { body, user: { _id: userId } } as never,
            res,
            jest.fn() as never,
        );
        return res;
    };

    const remove = async (userId: string, body: object) => {
        const controller = new DiaperLogController();
        const res = respond();
        await controller.deleteDiaperLogEntry(
            { body, user: { _id: userId } } as never,
            res,
            jest.fn() as never,
        );
        return res;
    };

    it("accepts a change logged now", async () => {
        const { userId, childId } = await createUserWithChild();

        const res = await post(userId, {
            childId,
            kind: "wet",
            loggedAt: new Date().toISOString(),
        });

        expect(res.status).toHaveBeenCalledWith(200);
        expect(await diaperLogModel.countDocuments({ userId })).toBe(1);
    });

    it("refuses a change dated to a day that has closed", async () => {
        const { userId, childId } = await createUserWithChild();

        const res = await post(userId, {
            childId,
            kind: "wet",
            loggedAt: new Date(Date.now() - 2 * 86_400_000).toISOString(),
        });

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({ message: messages.DIAPER_LOG_DAY_CLOSED }),
        );
        expect(await diaperLogModel.countDocuments({ userId })).toBe(0);
    });

    it("refuses removing from a day that has closed", async () => {
        const { userId, childId } = await createUserWithChild();

        const res = await remove(userId, {
            childId,
            loggedOn: formatDateToISO(new Date(getISTCalendarDate().getTime() - 86_400_000)),
            entryId: new Types.ObjectId().toString(),
        });

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({ message: messages.DIAPER_LOG_DAY_CLOSED }),
        );
    });

    it("refuses a change in the future", async () => {
        const { userId, childId } = await createUserWithChild();

        const res = await post(userId, {
            childId,
            kind: "wet",
            loggedAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        });

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({ message: messages.DIAPER_LOG_FUTURE_NOT_ALLOWED }),
        );
    });

    /**
     * A phone whose clock is a minute or two fast must not have a genuine tap rejected.
     * This compares instants rather than dates, so unlike the growth log the tolerance is
     * load-bearing rather than theoretical.
     */
    it("tolerates a phone clock running slightly fast", async () => {
        const { userId, childId } = await createUserWithChild();

        const res = await post(userId, {
            childId,
            kind: "wet",
            loggedAt: new Date(Date.now() + 60 * 1000).toISOString(),
        });

        expect(res.status).toHaveBeenCalledWith(200);
    });

    it("refuses a change from before the child was born", async () => {
        // Born today, so yesterday is both a closed day and before birth. Dating the birth
        // in the future instead keeps the instant inside today and isolates the birth rule.
        const { userId, childId } = await createUserWithChild({
            date_of_birth: formatDateToISO(new Date(Date.now() + 5 * 86_400_000)),
        });

        const res = await post(userId, {
            childId,
            kind: "wet",
            loggedAt: new Date().toISOString(),
        });

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({ message: messages.DIAPER_LOG_BEFORE_BIRTH }),
        );
    });

    it("reports a child that is not the caller's as not found", async () => {
        const mine = await createUserWithChild();
        const theirs = await createUserWithChild();

        const res = await post(mine.userId, {
            childId: theirs.childId,
            kind: "wet",
            loggedAt: new Date().toISOString(),
        });

        expect(res.status).toHaveBeenCalledWith(404);
    });
});

describe("the create validator", () => {
    const body = (overrides: object = {}) => ({
        childId: new Types.ObjectId().toString(),
        kind: "wet",
        loggedAt: new Date().toISOString(),
        ...overrides,
    });

    it("accepts each of the three kinds", () => {
        for (const kind of ["wet", "dirty", "both"]) {
            expect(diaperLogCreateValidator.validate(body({ kind })).error).toBeUndefined();
        }
    });

    it("rejects a kind outside the three", () => {
        expect(diaperLogCreateValidator.validate(body({ kind: "damp" })).error).toBeDefined();
    });

    /** A bare date would lose the time of day, which is the point of this log. */
    it("rejects a loggedAt that is not a real instant", () => {
        expect(
            diaperLogCreateValidator.validate(body({ loggedAt: "yesterday" })).error,
        ).toBeDefined();
    });
});

describe("child deletion", () => {
    /**
     * Diaper logs are keyed on childId rather than embedded in the user, so they do not go
     * when the child does. Left behind they are orphaned health data about a child the
     * parent believes they deleted — unreachable, because every read goes through an
     * ownership check that now fails.
     */
    it("takes the child's diaper logs with it", async () => {
        const { userId, childId } = await createUserWithChild();
        await service.addEntry({ userId, childId, kind: "wet", loggedAt: new Date() });

        await new ChildService().deleteChild(userId, childId);

        expect(await diaperLogModel.countDocuments({ userId, childId })).toBe(0);
    });
});
