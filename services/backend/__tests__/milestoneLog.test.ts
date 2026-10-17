/**
 * Milestone logs: the catalogue guard, the upsert, and the rules on the HTTP boundary.
 *
 * The shape under test differs from the other two log collections in one way that drives
 * everything else: this one is keyed on the *milestone*, not the calendar day. A milestone
 * is reached once. So re-logging corrects a date rather than adding a row, and there is no
 * closed-day rule to enforce.
 */

jest.mock(require.resolve("../src/config/firebase"), () => ({ __esModule: true, default: null }));
jest.mock(require.resolve("../src/config/redis.config"), () => ({ __esModule: true }));
jest.mock("razorpay", () =>
    jest.fn().mockImplementation(() => ({ orders: { create: jest.fn() } })),
);

import { Response } from "express";
import { Types } from "mongoose";

import { clearTestDb, closeTestDb, connectTestDb } from "./helpers/db";
import MilestoneLogController from "../src/api/v1/controllers/milestone-log/milestone-log.controller";
import {
    milestoneLogAchieveValidator,
} from "../src/api/v1/validators/milestone-log/milestone-log.validator";
import { MILESTONE_KEYS, isMilestoneKey } from "../src/constants/milestone-keys";
import { messages } from "../src/constants/messages";
import milestoneLogModel from "../src/models/milestone-log.model";
import UserModel from "../src/models/user.model";
import ChildService from "../src/services/childs/child.service";
import { formatDateToISO, getISTCalendarDate } from "../src/services/date/date.service";
import MilestoneLogService, {
    ChildNotFoundError,
} from "../src/services/milestone-log/milestone-log.service";
import { EChildOnboardingStatus, ESex } from "../src/types/user.types";

jest.setTimeout(120000);

const service = new MilestoneLogService();

const SMILE = "develops_a_social_smile";
const HEAD_UP = "raises_head_at_times_when_on_tummy";

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

describe("the generated catalogue", () => {
    /**
     * The catalogue is emitted from the MCP card workbook. This number is fixed here so that
     * a regeneration which silently dropped rows fails on the API side too, rather than
     * shipping a validator that rejects milestones the app still renders.
     *
     * The card carries 33; the 3-year band's four are excluded in the generator and so are
     * not valid keys to write. See the `exclude` flag in
     * `scripts/generate-milestone-catalogue.mjs`.
     */
    it("carries every milestone the app ships", () => {
        expect(MILESTONE_KEYS).toHaveLength(29);
        expect(new Set(MILESTONE_KEYS).size).toBe(29);
    });

    /**
     * The excluded band is excluded here as well. A key the app can never render must not be
     * a key the API will accept — otherwise a stale client could store a row that no screen
     * can ever show, which is the exact thing validating against this list is for.
     */
    it("rejects the milestones of the excluded 3-year band", () => {
        for (const key of [
            "drinks_from_a_cup_without_spilling",
            "climbs_up_and_down_the_stairs",
            "names_most_familiar_things_consistently_identifies_colours",
            "makes_a_sentence_by_joining_3_or_more_words",
        ]) {
            expect(isMilestoneKey(key)).toBe(false);
        }
    });

    it("recognises its own keys and nothing else", () => {
        expect(isMilestoneKey(SMILE)).toBe(true);
        expect(isMilestoneKey("learns_to_drive")).toBe(false);
        expect(isMilestoneKey(undefined)).toBe(false);
    });
});

describe("achieve", () => {
    it("records a milestone against the child", async () => {
        const { userId, childId } = await createUserWithChild();

        const entry = await service.achieve({
            userId,
            childId,
            milestoneKey: SMILE,
            achievedOn: getISTCalendarDate(),
        });

        expect(entry.milestoneKey).toBe(SMILE);
        expect(await milestoneLogModel.countDocuments({ userId, childId })).toBe(1);
    });

    /**
     * The difference from growth and diaper logs: the unique key is the milestone, so
     * logging it again is a correction to its date, not a second row.
     */
    it("corrects the date rather than adding a second row", async () => {
        const { userId, childId } = await createUserWithChild();

        await service.achieve({
            userId,
            childId,
            milestoneKey: SMILE,
            achievedOn: new Date("2026-05-01T00:00:00.000Z"),
        });
        const second = await service.achieve({
            userId,
            childId,
            milestoneKey: SMILE,
            achievedOn: new Date("2026-05-08T00:00:00.000Z"),
        });

        expect(await milestoneLogModel.countDocuments({ userId, childId })).toBe(1);
        expect(formatDateToISO(second.achievedOn)).toBe("2026-05-08");
    });

    it("keeps different milestones apart", async () => {
        const { userId, childId } = await createUserWithChild();

        await service.achieve({ userId, childId, milestoneKey: SMILE, achievedOn: new Date() });
        await service.achieve({ userId, childId, milestoneKey: HEAD_UP, achievedOn: new Date() });

        expect(await milestoneLogModel.countDocuments({ userId, childId })).toBe(2);
    });

    it("refuses a child that does not belong to the caller", async () => {
        const mine = await createUserWithChild();
        const theirs = await createUserWithChild();

        await expect(
            service.achieve({
                userId: mine.userId,
                childId: theirs.childId,
                milestoneKey: SMILE,
                achievedOn: new Date(),
            }),
        ).rejects.toBeInstanceOf(ChildNotFoundError);
    });

    /** The schema enumerates the catalogue, so a bad key cannot reach the collection. */
    it("rejects a key outside the catalogue at the schema", async () => {
        const { userId, childId } = await createUserWithChild();

        await expect(
            milestoneLogModel.create({
                userId,
                childId,
                milestoneKey: "learns_to_drive",
                achievedOn: new Date(),
            }),
        ).rejects.toThrow();
    });
});

describe("forget", () => {
    it("removes a logged milestone", async () => {
        const { userId, childId } = await createUserWithChild();
        await service.achieve({ userId, childId, milestoneKey: SMILE, achievedOn: new Date() });

        expect(await service.forget({ userId, childId, milestoneKey: SMILE })).toBe(true);
        expect(await milestoneLogModel.countDocuments({ userId, childId })).toBe(0);
    });

    it("reports nothing removed for a milestone that was never logged", async () => {
        const { userId, childId } = await createUserWithChild();

        expect(await service.forget({ userId, childId, milestoneKey: SMILE })).toBe(false);
    });

    it("will not remove another user's milestone", async () => {
        const mine = await createUserWithChild();
        const theirs = await createUserWithChild();

        await service.achieve({
            userId: theirs.userId,
            childId: theirs.childId,
            milestoneKey: SMILE,
            achievedOn: new Date(),
        });

        await expect(
            service.forget({
                userId: mine.userId,
                childId: theirs.childId,
                milestoneKey: SMILE,
            }),
        ).rejects.toBeInstanceOf(ChildNotFoundError);

        expect(await milestoneLogModel.countDocuments({ userId: theirs.userId })).toBe(1);
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
        const controller = new MilestoneLogController();
        const res = respond();
        await controller.achieveMilestone(
            { body, user: { _id: userId } } as never,
            res,
            jest.fn() as never,
        );
        return res;
    };

    it("defaults an undated milestone to today", async () => {
        const { userId, childId } = await createUserWithChild();

        const res = await post(userId, { childId, milestoneKey: SMILE });

        expect(res.status).toHaveBeenCalledWith(200);
        const stored = await milestoneLogModel.findOne({ userId, childId }).lean();
        expect(formatDateToISO(stored!.achievedOn)).toBe(
            formatDateToISO(getISTCalendarDate()),
        );
    });

    /**
     * Deliberately allowed, unlike the growth and diaper logs. A parent notices "she rolled
     * over" days after it first happened; refusing to let them date it back would either
     * lose the date or push them to log it as today, which is worse than either.
     */
    it("accepts a past date", async () => {
        const { userId, childId } = await createUserWithChild();

        const res = await post(userId, {
            childId,
            milestoneKey: SMILE,
            achievedOn: formatDateToISO(new Date(getISTCalendarDate().getTime() - 30 * 86_400_000)),
        });

        expect(res.status).toHaveBeenCalledWith(200);
    });

    it("refuses a future date", async () => {
        const { userId, childId } = await createUserWithChild();

        const res = await post(userId, {
            childId,
            milestoneKey: SMILE,
            achievedOn: formatDateToISO(new Date(Date.now() + 3 * 86_400_000)),
        });

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({ message: messages.MILESTONE_LOG_FUTURE_NOT_ALLOWED }),
        );
    });

    it("refuses a date before the child was born", async () => {
        const { userId, childId } = await createUserWithChild({ date_of_birth: "2026-09-01" });

        const res = await post(userId, {
            childId,
            milestoneKey: SMILE,
            achievedOn: "2026-08-01",
        });

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({ message: messages.MILESTONE_LOG_BEFORE_BIRTH }),
        );
    });

    it("reports another user's child as not found", async () => {
        const mine = await createUserWithChild();
        const theirs = await createUserWithChild();

        const res = await post(mine.userId, {
            childId: theirs.childId,
            milestoneKey: SMILE,
        });

        expect(res.status).toHaveBeenCalledWith(404);
    });
});

describe("the achieve validator", () => {
    const body = (overrides: object = {}) => ({
        childId: new Types.ObjectId().toString(),
        milestoneKey: SMILE,
        ...overrides,
    });

    it("accepts every key in the catalogue", () => {
        for (const key of MILESTONE_KEYS) {
            expect(
                milestoneLogAchieveValidator.validate(body({ milestoneKey: key })).error,
            ).toBeUndefined();
        }
    });

    it("rejects a key outside the catalogue", () => {
        expect(
            milestoneLogAchieveValidator.validate(body({ milestoneKey: "learns_to_drive" }))
                .error,
        ).toBeDefined();
    });

    it("treats achievedOn as optional", () => {
        expect(milestoneLogAchieveValidator.validate(body()).error).toBeUndefined();
    });
});

describe("child deletion", () => {
    it("takes the child's milestones with it", async () => {
        const { userId, childId } = await createUserWithChild();
        await service.achieve({ userId, childId, milestoneKey: SMILE, achievedOn: new Date() });

        await new ChildService().deleteChild(userId, childId);

        expect(await milestoneLogModel.countDocuments({ userId, childId })).toBe(0);
    });
});
