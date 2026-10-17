jest.mock(require.resolve("../src/config/firebase"), () => ({ __esModule: true, default: null }));
jest.mock(require.resolve("../src/config/redis.config"), () => ({ __esModule: true }));
jest.mock("razorpay", () =>
    jest.fn().mockImplementation(() => ({ orders: { create: jest.fn() } })),
);

import { Types } from "mongoose";
import { clearTestDb, closeTestDb, connectTestDb } from "./helpers/db";
import expertCategoryModel from "../src/models/expert-category.model";
import expertModel from "../src/models/expert.model";
import UserModel from "../src/models/user.model";
import { ExpertService } from "../src/services/expert/expert.service";
import { isInPersonOnlyExpert } from "../src/services/expert/expert.rules";

jest.setTimeout(120000);

const service = new ExpertService();

async function ensureCategory(key: string, name: string) {
    return expertCategoryModel.findOneAndUpdate(
        { key },
        { $setOnInsert: { key, name, coveredAreas: ["a"] } },
        { upsert: true, new: true },
    );
}

async function makeExpert(overrides: Record<string, unknown> = {}) {
    const category = await ensureCategory("GYNECOLOGIST", "Gynaecologist");
    return expertModel.create({
        name: "Dr. Anita Rao",
        speciality: "Gynaecology",
        category: category._id,
        yearsOfExperience: 12,
        photograph: "https://example.com/a.jpg",
        remuneration: 700,
        is_empanelled_expert: false,
        // Unique+sparse, but defaults to null, and a sparse index still indexes an
        // explicit null — so two codeless experts collide. One per expert keeps that
        // out of these tests.
        referralCode: `REF${Math.random().toString(36).slice(2, 10)}`,
        ...overrides,
    });
}

async function makeUser(referredByExpertId?: unknown) {
    return UserModel.create({
        mobile_number: `9${Math.floor(Math.random() * 1_000_000_000)}`,
        referred_by_expert_id: referredByExpertId ?? null,
    });
}

const ids = (experts: { _id: unknown }[]) => experts.map((e) => String(e._id));

beforeAll(async () => {
    await connectTestDb();
});

afterAll(async () => {
    await closeTestDb();
});

afterEach(async () => {
    await clearTestDb();
});

describe("isInPersonOnlyExpert", () => {
    it("treats a zero fee as in-person only", () => {
        expect(isInPersonOnlyExpert({ remuneration: 0 })).toBe(true);
    });

    it("treats a real fee as bookable", () => {
        expect(isInPersonOnlyExpert({ remuneration: 700 })).toBe(false);
    });

    // A document that predates the field, or one seeded with a string, must not be
    // offered for booking either — Razorpay would get NaN paise.
    it("fails closed on a missing or unparseable fee", () => {
        expect(isInPersonOnlyExpert({})).toBe(true);
        expect(isInPersonOnlyExpert({ remuneration: "free" })).toBe(true);
    });
});

describe("ExpertService.getVisibleExperts — in-person-only doctors", () => {
    it("hides a zero-fee expert from a user with no referral", async () => {
        const paid = await makeExpert();
        await makeExpert({ name: "Dr. Anjana Arya", remuneration: 0 });
        const user = await makeUser();

        const visible = await service.getVisibleExperts(String(user._id));

        expect(ids(visible)).toEqual([String(paid._id)]);
    });

    it("hides a zero-fee expert from a user referred by a different doctor", async () => {
        const referrer = await makeExpert({ name: "Dr. Referrer", remuneration: 700 });
        const inPerson = await makeExpert({ name: "Dr. Anjana Arya", remuneration: 0 });
        const user = await makeUser(referrer._id);

        const visible = await service.getVisibleExperts(String(user._id));

        expect(ids(visible)).not.toContain(String(inPerson._id));
        expect(ids(visible)).toContain(String(referrer._id));
    });

    it("shows a zero-fee expert to the user she referred", async () => {
        const inPerson = await makeExpert({ name: "Dr. Anjana Arya", remuneration: 0 });
        const user = await makeUser(inPerson._id);

        const visible = await service.getVisibleExperts(String(user._id));

        expect(ids(visible)).toContain(String(inPerson._id));
    });

    // Rule 1 must not swallow rule 2: her patient still sees only her in her category.
    it("still applies the category rule for a referred user", async () => {
        const otherCategory = await ensureCategory("NUTRITIONIST", "Nutritionist");
        const inPerson = await makeExpert({ name: "Dr. Anjana Arya", remuneration: 0 });
        const sameCategoryRival = await makeExpert({ name: "Dr. Rival" });
        const otherCategoryExpert = await makeExpert({
            name: "Dr. Nutrition",
            category: otherCategory._id,
        });
        const user = await makeUser(inPerson._id);

        const visible = ids(await service.getVisibleExperts(String(user._id)));

        expect(visible).toContain(String(inPerson._id));
        expect(visible).toContain(String(otherCategoryExpert._id));
        expect(visible).not.toContain(String(sameCategoryRival._id));
    });

    // A deactivated referrer already means "show everyone"; that fallback must not
    // resurrect the in-person doctor for a stranger.
    it("keeps hiding in-person doctors when the referring expert is inactive", async () => {
        const referrer = await makeExpert({ name: "Dr. Gone", isActive: false });
        const inPerson = await makeExpert({ name: "Dr. Anjana Arya", remuneration: 0 });
        const user = await makeUser(referrer._id);

        const visible = ids(await service.getVisibleExperts(String(user._id)));

        expect(visible).not.toContain(String(inPerson._id));
    });
});

describe("ExpertService.getVisibleExpertById", () => {
    it("refuses an in-person-only expert to a user who is not hers", async () => {
        const inPerson = await makeExpert({ name: "Dr. Anjana Arya", remuneration: 0 });
        const user = await makeUser();

        expect(await service.getVisibleExpertById(String(user._id), String(inPerson._id))).toBeNull();
    });

    it("serves her to her own referred patient", async () => {
        const inPerson = await makeExpert({ name: "Dr. Anjana Arya", remuneration: 0 });
        const user = await makeUser(inPerson._id);

        const found = await service.getVisibleExpertById(String(user._id), String(inPerson._id));

        expect(String(found?._id)).toBe(String(inPerson._id));
    });

    it("answers null for an id that names nobody", async () => {
        const user = await makeUser();

        const found = await service.getVisibleExpertById(
            String(user._id),
            String(new Types.ObjectId()),
        );

        expect(found).toBeNull();
    });
});
