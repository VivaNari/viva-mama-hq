/**
 * Direct child CRUD — the non-chat path onto users.childs[].
 *
 * Two things are worth pinning here. Measurements are merged field by field, so editing
 * one does not erase the other two recorded at birth — and the fields a child's history is
 * derived from cannot be edited at all, which is asserted below rather than left to the
 * validator, since the service is what a future caller would reach past it to use.
 */

jest.mock(require.resolve("../src/config/firebase"), () => ({ __esModule: true, default: null }));
jest.mock(require.resolve("../src/config/redis.config"), () => ({ __esModule: true }));
jest.mock("razorpay", () =>
    jest.fn().mockImplementation(() => ({ orders: { create: jest.fn() } })),
);

import { Types } from "mongoose";

import { clearTestDb, closeTestDb, connectTestDb } from "./helpers/db";
import UserModel from "../src/models/user.model";
import ChildService, { ChildNotFoundError } from "../src/services/childs/child.service";
import { EChildOnboardingStatus, ESex } from "../src/types/user.types";

jest.setTimeout(120000);

const service = new ChildService();

async function createUser() {
    return UserModel.create({ phone_number: "9000000003" });
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

describe("ChildService", () => {
    it("adds a child as COMPLETED, not DRAFT", async () => {
        // The caller supplied everything in one request, so there is no run to resume.
        // DRAFT belongs to the chat flow alone.
        const user = await createUser();
        const child = await service.addChild({
            userId: user._id.toString(),
            name: "Aarav",
            date_of_birth: "2026-08-28",
            sex: ESex.MALE,
        });

        expect(child.name).toBe("Aarav");
        expect(child.onboarding_status).toBe(EChildOnboardingStatus.COMPLETED);
        expect(child._id).toBeDefined();
    });

    it("returns only the child, not the entire user document", async () => {
        // The previous implementation returned the whole user — subscription snapshot,
        // onboarding answers and all — on every add.
        const user = await createUser();
        const child: any = await service.addChild({
            userId: user._id.toString(),
            name: "Aarav",
            date_of_birth: "2026-08-28",
            sex: ESex.MALE,
        });

        expect(child.phone_number).toBeUndefined();
        expect(child.onboarding_data).toBeUndefined();
        expect(child.subscription).toBeUndefined();
    });

    it("updates only the fields supplied", async () => {
        const user = await createUser();
        const userId = user._id.toString();
        const created = await service.addChild({
            userId,
            name: "Aarav",
            date_of_birth: "2026-08-28",
            sex: ESex.MALE,
        });

        const updated = await service.updateChild({
            userId,
            childId: created._id!.toString(),
            name: "Aarav Kumar",
        });

        expect(updated.name).toBe("Aarav Kumar");
        expect(updated.sex).toBe(ESex.MALE);
        expect(updated.date_of_birth).toEqual(new Date("2026-08-28"));
    });

    it("merges birth measurements instead of replacing them", async () => {
        const user = await createUser();
        const userId = user._id.toString();
        const created = await service.addChild({
            userId,
            name: "Aarav",
            date_of_birth: "2026-08-28",
            sex: ESex.MALE,
        });
        const childId = created._id!.toString();

        await service.updateChild({
            userId,
            childId,
            birth_measurements: { length_cm: 50.5, weight_grams: 3250 },
        });

        // Sending only a weight must not wipe the length recorded alongside it.
        const updated = await service.updateChild({
            userId,
            childId,
            birth_measurements: { weight_grams: 3300 },
        });

        expect(updated.birth_measurements).toMatchObject({
            length_cm: 50.5,
            weight_grams: 3300,
        });
    });

    it("touches only the addressed child", async () => {
        const user = await createUser();
        const userId = user._id.toString();

        const first = await service.addChild({
            userId, name: "Aarav", date_of_birth: "2026-08-28", sex: ESex.MALE,
        });
        const second = await service.addChild({
            userId, name: "Meera", date_of_birth: "2024-01-10", sex: ESex.FEMALE,
        });

        await service.updateChild({
            userId,
            childId: first._id!.toString(),
            name: "Renamed",
        });

        const children = await service.listChildren(userId);
        const untouched = children.find((c) => c._id!.toString() === second._id!.toString());
        expect(untouched!.name).toBe("Meera");
    });

    /**
     * Date of birth, sex and vaccination sector are set at baby onboarding and frozen.
     *
     * They are the basis of every derived number on the child — percentiles, due dates, the
     * solids gate, each date strip's floor — so an edit would not change a value, it would
     * invalidate a history. `UpdateChildParams` no longer carries them, which makes this a
     * compile error as well as a runtime one; the validator refuses them at the boundary too.
     */
    it("has no way to change the fields a child's history is derived from", async () => {
        const user = await createUser();
        const added = await service.addChild({
            userId: user._id.toString(),
            name: "Aarav",
            date_of_birth: "2026-03-14",
            sex: ESex.MALE,
        });

        const fresh = await service.updateChild({
            userId: user._id.toString(),
            childId: added._id!.toString(),
            name: "Aarav Kumar",
            // @ts-expect-error — not on UpdateChildParams, and that is the point.
            date_of_birth: "2020-01-01",
            // @ts-expect-error — likewise.
            sex: ESex.FEMALE,
        });

        expect(fresh.name).toBe("Aarav Kumar");
        expect(fresh.date_of_birth).toEqual(new Date("2026-03-14"));
        expect(fresh.sex).toBe(ESex.MALE);
    });

    it("deletes a child", async () => {
        const user = await createUser();
        const userId = user._id.toString();
        const created = await service.addChild({
            userId, name: "Aarav", date_of_birth: "2026-08-28", sex: ESex.MALE,
        });

        await service.deleteChild(userId, created._id!.toString());
        expect(await service.listChildren(userId)).toHaveLength(0);
    });

    it("reports a missing child rather than silently succeeding", async () => {
        const user = await createUser();
        const userId = user._id.toString();
        const strayId = new Types.ObjectId().toString();

        await expect(
            service.updateChild({ userId, childId: strayId, name: "Nobody" }),
        ).rejects.toBeInstanceOf(ChildNotFoundError);

        await expect(service.deleteChild(userId, strayId)).rejects.toBeInstanceOf(
            ChildNotFoundError,
        );
    });

    it("rejects a malformed childId without hitting the database", async () => {
        const user = await createUser();
        await expect(
            service.updateChild({ userId: user._id.toString(), childId: "nope", name: "x" }),
        ).rejects.toBeInstanceOf(ChildNotFoundError);
    });

    it("lists DRAFT children too, leaving filtering to the caller", async () => {
        // The dashboard hides drafts; the resume check needs to see them.
        const user = await createUser();
        const userId = user._id.toString();

        await UserModel.updateOne(
            { _id: user._id },
            { $push: { childs: { onboarding_status: EChildOnboardingStatus.DRAFT } } },
        );

        expect(await service.listChildren(userId)).toHaveLength(1);
    });
});
