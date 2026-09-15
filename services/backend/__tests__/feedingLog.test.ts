/**
 * Feeding logs: the three entry kinds, the six-month gate, and the per-child settings.
 *
 * The shape follows the diaper log rather than the vaccination one — a feed belongs to a
 * day, the day is the key, and the same closed-day rule applies. What it adds is an age
 * gate that no other log has. Solids and water are refused below six months on clinical
 * guidance (WHO and IAP both advise exclusive milk to six completed months), so the
 * boundary is asserted from both sides: 182 days is refused and 183 is accepted. A test
 * that only checked the refusal would still pass if the gate never opened at all.
 *
 * The settings tests exist for a decision rather than a mechanism. Writing the feeding
 * method could easily have been made to update the mother's own onboarding answer and the
 * `is_breastfeeding_currently` flag derived from it — that flag decides which weekly
 * check-in questions she is asked. It deliberately does not, and the only way to keep that
 * true is to assert it.
 *
 * Run:  npx jest feedingLog
 */

jest.mock(require.resolve("../src/config/firebase"), () => ({ __esModule: true, default: null }));
jest.mock(require.resolve("../src/config/redis.config"), () => ({ __esModule: true }));
jest.mock("razorpay", () =>
    jest.fn().mockImplementation(() => ({ orders: { create: jest.fn() } })),
);

import { Response } from "express";
import { Types } from "mongoose";

import { clearTestDb, closeTestDb, connectTestDb } from "./helpers/db";
import FeedingLogController from "../src/api/v1/controllers/feeding-log/feeding-log.controller";
import {
    feedingLogCreateValidator,
    feedingLogSettingsValidator,
} from "../src/api/v1/validators/feeding-log/feeding-log.validator";
import { messages } from "../src/constants/messages";
import feedingLogModel from "../src/models/feeding-log.model";
import UserModel from "../src/models/user.model";
import ChildService from "../src/services/childs/child.service";
import { formatDateToISO, getISTCalendarDate } from "../src/services/date/date.service";
import FeedingLogService, {
    ChildNotFoundError,
    SOLIDS_MIN_AGE_DAYS,
    totalsFor,
} from "../src/services/feeding-log/feeding-log.service";
import {
    EChildOnboardingStatus,
    ESex,
    FeedingMethodEnum,
} from "../src/types/user.types";

jest.setTimeout(120000);

const service = new FeedingLogService();

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** A date of birth that makes the child exactly `days` old today, in IST. */
const dobForAge = (days: number): Date =>
    new Date(getISTCalendarDate().getTime() - days * MS_PER_DAY);

/** An instant earlier today, so every write lands on today's IST day. */
const earlierToday = (minutesAgo = 90): Date => new Date(Date.now() - minutesAgo * 60000);

async function createUserWithChild(
    overrides: {
        ageInDays?: number;
        feedingMethod?: FeedingMethodEnum;
        solidsStartedOn?: Date | null;
        onboardingFeedingMethod?: FeedingMethodEnum;
    } = {},
) {
    const childId = new Types.ObjectId();

    const user = await UserModel.create({
        phone_number: `9${Math.floor(100000000 + Math.random() * 899999999)}`,
        ...(overrides.onboardingFeedingMethod
            ? { onboarding_data: { feeding_method: overrides.onboardingFeedingMethod } }
            : {}),
        childs: [
            {
                _id: childId,
                name: "Aarav",
                date_of_birth: dobForAge(overrides.ageInDays ?? 60),
                sex: ESex.MALE,
                onboarding_status: EChildOnboardingStatus.COMPLETED,
                ...(overrides.feedingMethod ? { feeding_method: overrides.feedingMethod } : {}),
                ...(overrides.solidsStartedOn !== undefined
                    ? { solids_started_on: overrides.solidsStartedOn }
                    : {}),
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

/* ------------------------------ the service ------------------------------- */

describe("recording entries", () => {
    it("appends a breast feed and creates the day", async () => {
        const { userId, childId } = await createUserWithChild();

        const result = await service.addEntry({
            userId,
            childId,
            kind: "feed",
            entry: {
                _id: new Types.ObjectId(),
                source: "breast",
                side: "left",
                minutes: 18,
                feedAt: earlierToday(),
            } as never,
            at: earlierToday(),
            feedingMethod: FeedingMethodEnum.ONLY_BREASTMILK,
        });

        expect(result.totals.feeds).toBe(1);

        const day = await feedingLogModel.findOne({ userId, childId });
        expect(day?.feeds).toHaveLength(1);
        expect(day?.feeds[0]?.side).toBe("left");
        expect(day?.feedingMethod).toBe(FeedingMethodEnum.ONLY_BREASTMILK);
    });

    /**
     * Two people logging the same baby's day is ordinary here — partner accounts exist —
     * so the second write must land beside the first rather than replacing the day.
     */
    it("appends rather than replacing when a second entry arrives", async () => {
        const { userId, childId } = await createUserWithChild();

        const add = (minutesAgo: number) =>
            service.addEntry({
                userId,
                childId,
                kind: "feed",
                entry: {
                    _id: new Types.ObjectId(),
                    source: "bottle",
                    ml: 90,
                    feedAt: earlierToday(minutesAgo),
                } as never,
                at: earlierToday(minutesAgo),
                feedingMethod: FeedingMethodEnum.MIXED,
            });

        await add(180);
        const second = await add(60);

        expect(second.totals.feeds).toBe(2);
        expect(await feedingLogModel.countDocuments({ userId, childId })).toBe(1);
    });

    it("keeps the three kinds in their own arrays", async () => {
        const { userId, childId } = await createUserWithChild({
            ageInDays: 200,
            solidsStartedOn: new Date(),
        });

        const at = earlierToday();

        await service.addEntry({
            userId, childId, kind: "feed", at,
            entry: { _id: new Types.ObjectId(), source: "breast", side: "right", minutes: 10, feedAt: at } as never,
            feedingMethod: FeedingMethodEnum.ONLY_BREASTMILK,
        });
        await service.addEntry({
            userId, childId, kind: "solid", at,
            entry: { _id: new Types.ObjectId(), food: "Dal water", reactions: ["liked"], feedAt: at } as never,
            feedingMethod: FeedingMethodEnum.ONLY_BREASTMILK,
        });
        await service.addEntry({
            userId, childId, kind: "water", at,
            entry: { _id: new Types.ObjectId(), ml: 30, drankAt: at } as never,
            feedingMethod: FeedingMethodEnum.ONLY_BREASTMILK,
        });

        const day = await feedingLogModel.findOne({ userId, childId }).lean();

        expect(day?.feeds).toHaveLength(1);
        expect(day?.solids).toHaveLength(1);
        expect(day?.water).toHaveLength(1);
        expect(totalsFor(day!)).toMatchObject({ feeds: 1, solids: 1, waterMl: 30 });
    });

    /**
     * The day stamps the method it was opened under and keeps it. A mother who moves to
     * formula in October must not have July read back as formula.
     */
    it("does not restamp the day's method on a later entry", async () => {
        const { userId, childId } = await createUserWithChild();
        const at = earlierToday();

        await service.addEntry({
            userId, childId, kind: "feed", at,
            entry: { _id: new Types.ObjectId(), source: "breast", side: "left", minutes: 12, feedAt: at } as never,
            feedingMethod: FeedingMethodEnum.ONLY_BREASTMILK,
        });
        await service.addEntry({
            userId, childId, kind: "feed", at,
            entry: { _id: new Types.ObjectId(), source: "bottle", ml: 60, feedAt: at } as never,
            feedingMethod: FeedingMethodEnum.NOT_BREASTFEEDING,
        });

        const day = await feedingLogModel.findOne({ userId, childId });
        expect(day?.feedingMethod).toBe(FeedingMethodEnum.ONLY_BREASTMILK);
    });
});

describe("removing entries", () => {
    const seed = async () => {
        const { userId, childId } = await createUserWithChild();
        const at = earlierToday();
        const _id = new Types.ObjectId();

        await service.addEntry({
            userId, childId, kind: "feed", at,
            entry: { _id, source: "breast", side: "left", minutes: 15, feedAt: at } as never,
            feedingMethod: FeedingMethodEnum.ONLY_BREASTMILK,
        });

        return { userId, childId, entryId: _id.toString(), loggedOn: getISTCalendarDate(at) };
    };

    it("pulls the entry and reports the new totals", async () => {
        const { userId, childId, entryId, loggedOn } = await seed();

        const result = await service.removeEntry({
            userId, childId, loggedOn, kind: "feed", entryId,
        });

        expect(result).toMatchObject({ removed: true });
        expect(result.totals.feeds).toBe(0);
    });

    /** An entry id alone must not be enough to delete from someone else's day. */
    it("refuses an entry belonging to another user's child", async () => {
        const { entryId, loggedOn } = await seed();
        const intruder = await createUserWithChild();

        const result = await service.removeEntry({
            userId: intruder.userId,
            childId: intruder.childId,
            loggedOn,
            kind: "feed",
            entryId,
        });

        expect(result.removed).toBe(false);
    });

    /** Asking the wrong array for an id that exists in another must not find it. */
    it("does not pull a feed through the solid kind", async () => {
        const { userId, childId, entryId, loggedOn } = await seed();

        const result = await service.removeEntry({
            userId, childId, loggedOn, kind: "solid", entryId,
        });

        expect(result.removed).toBe(false);
    });
});

describe("resolving the settings a screen opens with", () => {
    it("prefers the child's own method", async () => {
        const { userId, childId } = await createUserWithChild({
            feedingMethod: FeedingMethodEnum.MIXED,
            onboardingFeedingMethod: FeedingMethodEnum.ONLY_BREASTMILK,
        });

        const { settings } = await service.resolveSettings(userId, childId);

        expect(settings.feedingMethod).toBe(FeedingMethodEnum.MIXED);
        expect(settings.feedingMethodSource).toBe("child");
    });

    /** The whole point of sharing one vocabulary with the mother's onboarding answer. */
    it("falls back to the mother's onboarding answer", async () => {
        const { userId, childId } = await createUserWithChild({
            onboardingFeedingMethod: FeedingMethodEnum.NOT_BREASTFEEDING,
        });

        const { settings } = await service.resolveSettings(userId, childId);

        expect(settings.feedingMethod).toBe(FeedingMethodEnum.NOT_BREASTFEEDING);
        expect(settings.feedingMethodSource).toBe("onboarding");
    });

    it("falls back again when she was never asked", async () => {
        const { userId, childId } = await createUserWithChild();

        const { settings } = await service.resolveSettings(userId, childId);

        expect(settings.feedingMethod).toBe(FeedingMethodEnum.ONLY_BREASTMILK);
        expect(settings.feedingMethodSource).toBe("default");
    });

    it("reports whether the child is old enough for solids", async () => {
        const young = await createUserWithChild({ ageInDays: SOLIDS_MIN_AGE_DAYS - 1 });
        const old = await createUserWithChild({ ageInDays: SOLIDS_MIN_AGE_DAYS });

        expect((await service.resolveSettings(young.userId, young.childId)).settings
            .solidsAvailable).toBe(false);
        expect((await service.resolveSettings(old.userId, old.childId)).settings
            .solidsAvailable).toBe(true);
    });

    it("refuses a child belonging to someone else", async () => {
        const mine = await createUserWithChild();
        const theirs = await createUserWithChild();

        await expect(service.resolveSettings(mine.userId, theirs.childId)).rejects.toBeInstanceOf(
            ChildNotFoundError,
        );
    });
});

/* ----------------------------- the validator ------------------------------ */

describe("the request validator", () => {
    const childId = new Types.ObjectId().toString();
    const feedAt = new Date().toISOString();

    it("accepts a breast feed with a side and minutes", () => {
        const { error } = feedingLogCreateValidator.validate({
            childId, kind: "feed", source: "breast", side: "left", minutes: 20, feedAt,
        });
        expect(error).toBeUndefined();
    });

    it("rejects a breast feed with no side", () => {
        const { error } = feedingLogCreateValidator.validate({
            childId, kind: "feed", source: "breast", minutes: 20, feedAt,
        });
        expect(error?.message).toContain("side");
    });

    /**
     * Forbidden rather than ignored. A client sending minutes for a bottle has a bug, and
     * dropping the field quietly would store a bottle feed with no volume and tell nobody.
     */
    it("rejects minutes on a bottle feed", () => {
        const { error } = feedingLogCreateValidator.validate({
            childId, kind: "feed", source: "bottle", ml: 90, minutes: 20, feedAt,
        });
        expect(error?.message).toContain("minutes");
    });

    it("rejects an unknown food reaction", () => {
        const { error } = feedingLogCreateValidator.validate({
            childId, kind: "solid", food: "Khichdi", reactions: ["delighted"], feedAt,
        });
        expect(error).toBeDefined();
    });

    it("rejects a settings patch that changes nothing", () => {
        const { error } = feedingLogSettingsValidator.validate({ childId });
        expect(error).toBeDefined();
    });

    /** Clearing is a real instruction, so null has to pass where "absent" would not. */
    it("accepts a null solids start date", () => {
        const { error } = feedingLogSettingsValidator.validate({
            childId,
            solidsStartedOn: null,
        });
        expect(error).toBeUndefined();
    });
});

/* --------------------------- the HTTP boundary ---------------------------- */

describe("the HTTP boundary", () => {
    const respond = () => {
        const res: Record<string, unknown> = {};
        res.status = jest.fn().mockReturnValue(res);
        res.json = jest.fn().mockReturnValue(res);
        return res as unknown as Response & { status: jest.Mock; json: jest.Mock };
    };

    const call = async (
        method: "createFeedingLogEntry" | "deleteFeedingLogEntry" | "updateFeedingSettings",
        userId: string,
        body: object,
    ) => {
        const controller = new FeedingLogController();
        const res = respond();
        await controller[method](
            { body, user: { _id: userId } } as never,
            res,
            jest.fn() as never,
        );
        return res;
    };

    const get = async (userId: string, query: object) => {
        const controller = new FeedingLogController();
        const res = respond();
        await controller.getChildFeedingLogs(
            { query, user: { _id: userId } } as never,
            res,
            jest.fn() as never,
        );
        return res;
    };

    const post = (userId: string, body: object) =>
        call("createFeedingLogEntry", userId, body);

    const message = (res: { json: jest.Mock }) => res.json.mock.calls[0][0].message;
    const payload = (res: { json: jest.Mock }) => res.json.mock.calls[0][0].data;

    it("records a feed for today", async () => {
        const { userId, childId } = await createUserWithChild();

        const res = await post(userId, {
            childId,
            kind: "feed",
            source: "breast",
            side: "right",
            minutes: 14,
            feedAt: earlierToday().toISOString(),
        });

        expect(res.status).toHaveBeenCalledWith(200);
        expect(payload(res).loggedOn).toBe(formatDateToISO(getISTCalendarDate()));
        expect(payload(res).totals.feeds).toBe(1);
    });

    it("refuses a feed in the future", async () => {
        const { userId, childId } = await createUserWithChild();

        const res = await post(userId, {
            childId,
            kind: "feed",
            source: "bottle",
            ml: 60,
            feedAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        });

        expect(res.status).toHaveBeenCalledWith(400);
        expect(message(res)).toBe(messages.FEEDING_LOG_FUTURE_NOT_ALLOWED);
    });

    /**
     * The closed-day rule, enforced here rather than only in the app. The UI hides the
     * composer on a past day, but without this the endpoint would take any past instant.
     */
    it("refuses a feed on a day that has closed", async () => {
        const { userId, childId } = await createUserWithChild();

        const res = await post(userId, {
            childId,
            kind: "feed",
            source: "bottle",
            ml: 60,
            feedAt: new Date(Date.now() - 2 * MS_PER_DAY).toISOString(),
        });

        expect(res.status).toHaveBeenCalledWith(400);
        expect(message(res)).toBe(messages.FEEDING_LOG_DAY_CLOSED);
    });

    it("refuses a child belonging to another user", async () => {
        const mine = await createUserWithChild();
        const theirs = await createUserWithChild();

        const res = await post(mine.userId, {
            childId: theirs.childId,
            kind: "feed",
            source: "bottle",
            ml: 60,
            feedAt: earlierToday().toISOString(),
        });

        expect(res.status).toHaveBeenCalledWith(404);
    });

    describe("the six-month gate", () => {
        const solid = (childId: string) => ({
            childId,
            kind: "solid",
            food: "Mashed banana",
            reactions: ["liked"],
            feedAt: earlierToday().toISOString(),
        });

        it("refuses a solid the day before six months", async () => {
            const { userId, childId } = await createUserWithChild({
                ageInDays: SOLIDS_MIN_AGE_DAYS - 1,
                solidsStartedOn: new Date(),
            });

            const res = await post(userId, solid(childId));

            expect(res.status).toHaveBeenCalledWith(400);
            expect(message(res)).toBe(messages.FEEDING_LOG_SOLIDS_TOO_EARLY);
        });

        /** The other side of the boundary. Without this the gate could simply never open. */
        it("accepts a solid on the day six months lands", async () => {
            const { userId, childId } = await createUserWithChild({
                ageInDays: SOLIDS_MIN_AGE_DAYS,
                solidsStartedOn: new Date(),
            });

            const res = await post(userId, solid(childId));

            expect(res.status).toHaveBeenCalledWith(200);
        });

        /**
         * Old enough is not the same as started. A solid logged before the mother has said
         * complementary feeding began would be a record nobody made.
         */
        it("refuses a solid before solids have been started", async () => {
            const { userId, childId } = await createUserWithChild({ ageInDays: 210 });

            const res = await post(userId, solid(childId));

            expect(res.status).toHaveBeenCalledWith(400);
            expect(message(res)).toBe(messages.FEEDING_LOG_SOLIDS_NOT_STARTED);
        });

        it("applies the same gate to water", async () => {
            const { userId, childId } = await createUserWithChild({ ageInDays: 90 });

            const res = await post(userId, {
                childId,
                kind: "water",
                ml: 30,
                drankAt: earlierToday().toISOString(),
            });

            expect(res.status).toHaveBeenCalledWith(400);
            expect(message(res)).toBe(messages.FEEDING_LOG_SOLIDS_TOO_EARLY);
        });

        /** Milk is never gated. A newborn's whole log is feeds. */
        it("leaves milk feeds alone at any age", async () => {
            const { userId, childId } = await createUserWithChild({ ageInDays: 3 });

            const res = await post(userId, {
                childId,
                kind: "feed",
                source: "breast",
                side: "left",
                minutes: 9,
                feedAt: earlierToday().toISOString(),
            });

            expect(res.status).toHaveBeenCalledWith(200);
        });
    });

    describe("the settings patch", () => {
        it("writes the method onto the child", async () => {
            const { userId, childId } = await createUserWithChild();

            const res = await call("updateFeedingSettings", userId, {
                childId,
                feedingMethod: FeedingMethodEnum.NOT_BREASTFEEDING,
            });

            expect(res.status).toHaveBeenCalledWith(200);
            expect(payload(res).settings.feedingMethod).toBe(
                FeedingMethodEnum.NOT_BREASTFEEDING,
            );

            const user = await UserModel.findById(userId).lean();
            expect(user?.childs?.[0]?.feeding_method).toBe(
                FeedingMethodEnum.NOT_BREASTFEEDING,
            );
        });

        /**
         * The decision this whole describe exists for.
         *
         * `is_breastfeeding_currently` decides which weekly check-in questions the mother
         * is asked and what the score engine reads. A baby's feeding log does not move it,
         * and neither does it rewrite her own onboarding answer.
         */
        it("leaves the mother's own record untouched", async () => {
            const { userId, childId } = await createUserWithChild({
                onboardingFeedingMethod: FeedingMethodEnum.ONLY_BREASTMILK,
            });
            await UserModel.updateOne(
                { _id: userId },
                { $set: { is_breastfeeding_currently: true } },
            );

            await call("updateFeedingSettings", userId, {
                childId,
                feedingMethod: FeedingMethodEnum.NOT_BREASTFEEDING,
            });

            const user = await UserModel.findById(userId).lean();
            expect(user?.is_breastfeeding_currently).toBe(true);
            expect(user?.onboarding_data?.feeding_method).toBe(
                FeedingMethodEnum.ONLY_BREASTMILK,
            );
        });

        /** Today follows the change; a day already logged keeps the method it was logged under. */
        it("rewrites today's row and no earlier one", async () => {
            const { userId, childId } = await createUserWithChild();
            const at = earlierToday();

            await service.addEntry({
                userId, childId, kind: "feed", at,
                entry: { _id: new Types.ObjectId(), source: "breast", side: "left", minutes: 11, feedAt: at } as never,
                feedingMethod: FeedingMethodEnum.ONLY_BREASTMILK,
            });

            const yesterday = new Date(getISTCalendarDate().getTime() - MS_PER_DAY);
            await feedingLogModel.create({
                userId,
                childId,
                loggedOn: yesterday,
                feedingMethod: FeedingMethodEnum.ONLY_BREASTMILK,
            });

            await call("updateFeedingSettings", userId, {
                childId,
                feedingMethod: FeedingMethodEnum.MIXED,
            });

            const today = await feedingLogModel.findOne({
                userId, childId, loggedOn: getISTCalendarDate(),
            });
            const past = await feedingLogModel.findOne({ userId, childId, loggedOn: yesterday });

            expect(today?.feedingMethod).toBe(FeedingMethodEnum.MIXED);
            expect(past?.feedingMethod).toBe(FeedingMethodEnum.ONLY_BREASTMILK);
        });

        it("refuses a solids start date before six months", async () => {
            const { userId, childId } = await createUserWithChild({ ageInDays: 100 });

            const res = await call("updateFeedingSettings", userId, {
                childId,
                solidsStartedOn: formatDateToISO(getISTCalendarDate()),
            });

            expect(res.status).toHaveBeenCalledWith(400);
            expect(message(res)).toBe(messages.FEEDING_LOG_SOLIDS_TOO_EARLY);
        });

        /**
         * Back-dating is checked against the date being claimed, not against today —
         * otherwise a nine-month-old's start date could be set to its second month.
         */
        it("refuses a start date back-dated to before six months", async () => {
            const { userId, childId } = await createUserWithChild({ ageInDays: 270 });

            const res = await call("updateFeedingSettings", userId, {
                childId,
                solidsStartedOn: formatDateToISO(
                    new Date(getISTCalendarDate().getTime() - 200 * MS_PER_DAY),
                ),
            });

            expect(res.status).toHaveBeenCalledWith(400);
            expect(message(res)).toBe(messages.FEEDING_LOG_SOLIDS_TOO_EARLY);
        });

        /** A mother who taps "started" and finds the baby refuses must be able to take it back. */
        it("allows clearing the start date", async () => {
            const { userId, childId } = await createUserWithChild({
                ageInDays: 200,
                solidsStartedOn: new Date(),
            });

            const res = await call("updateFeedingSettings", userId, {
                childId,
                solidsStartedOn: null,
            });

            expect(res.status).toHaveBeenCalledWith(200);
            expect(payload(res).settings.solidsStartedOn).toBeNull();
        });
    });

    it("returns the settings alongside the days", async () => {
        const { userId, childId } = await createUserWithChild({
            feedingMethod: FeedingMethodEnum.MIXED,
        });
        const at = earlierToday();

        await service.addEntry({
            userId, childId, kind: "feed", at,
            entry: { _id: new Types.ObjectId(), source: "bottle", ml: 80, feedAt: at } as never,
            feedingMethod: FeedingMethodEnum.MIXED,
        });

        const res = await get(userId, { childId });

        expect(res.status).toHaveBeenCalledWith(200);
        expect(payload(res).settings.feedingMethod).toBe(FeedingMethodEnum.MIXED);
        expect(payload(res).days).toHaveLength(1);
        expect(payload(res).days[0].totals.feeds).toBe(1);
    });

    it("refuses to remove from a closed day", async () => {
        const { userId, childId } = await createUserWithChild();

        const res = await call("deleteFeedingLogEntry", userId, {
            childId,
            loggedOn: formatDateToISO(new Date(getISTCalendarDate().getTime() - MS_PER_DAY)),
            kind: "feed",
            entryId: new Types.ObjectId().toString(),
        });

        expect(res.status).toHaveBeenCalledWith(400);
        expect(message(res)).toBe(messages.FEEDING_LOG_DAY_CLOSED);
    });

    it("reports a missing entry as not found", async () => {
        const { userId, childId } = await createUserWithChild();

        const res = await call("deleteFeedingLogEntry", userId, {
            childId,
            loggedOn: formatDateToISO(getISTCalendarDate()),
            kind: "feed",
            entryId: new Types.ObjectId().toString(),
        });

        expect(res.status).toHaveBeenCalledWith(404);
    });
});

/* --------------------------- the child lifecycle -------------------------- */

describe("deleting a child", () => {
    it("takes the feeding logs with it", async () => {
        const { userId, childId } = await createUserWithChild();
        const at = earlierToday();

        await service.addEntry({
            userId, childId, kind: "feed", at,
            entry: { _id: new Types.ObjectId(), source: "breast", side: "left", minutes: 16, feedAt: at } as never,
            feedingMethod: FeedingMethodEnum.ONLY_BREASTMILK,
        });

        await new ChildService().deleteChild(userId, childId);

        expect(await feedingLogModel.countDocuments({ userId, childId })).toBe(0);
    });
});
