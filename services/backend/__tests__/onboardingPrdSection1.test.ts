/**
 * PRD section 1 onboarding: the flow migration, what each new answer saves, who sees each
 * question, the risk flags, and that sensitive answers stay protected.
 */

jest.mock(require.resolve("../src/config/firebase"), () => ({ __esModule: true, default: null }));
jest.mock(require.resolve("../src/config/redis.config"), () => ({ __esModule: true }));
jest.mock("razorpay", () =>
    jest.fn().mockImplementation(() => ({ orders: { create: jest.fn() } })),
);
jest.mock(require.resolve("../src/utils/sendPushNotification"), () => ({
    __esModule: true,
    sendPushNotification: jest.fn(async () => undefined),
}));

import { clearTestDb, closeTestDb, connectTestDb } from "./helpers/db";
import { isOnboardingNodeUnlocked, NN_WOMEN_INDICATORS } from "../src/constants/chat";
import { freeTextForStorage, SKIP_ANSWER } from "../src/constants/onboarding";
import { sanitizeOnboardingPatch } from "../src/api/v1/controllers/users/user.controller";
import flowDefinitionModel from "../src/models/flowDefinition.model";
import healthRecordModel from "../src/models/health-record.model";
import motherLogModel from "../src/models/mother-log.model";
import UserModel from "../src/models/user.model";
import ChatFlowService from "../src/services/chat-system/chat-flow.service";
import { decryptField, encryptField } from "../src/services/crypto/field-encryption.service";
import { migrate } from "../src/services/migration/steps/update-onboarding-prd-section1.step";
import { refreshRiskFlags } from "../src/services/users/risk-flags.service";
import UserService from "../src/services/users/user.service";
import FlowService from "../src/services/weekly-checkin-v1/flow.service";
import { entitlementService } from "../src/services/entitlements/entitlement.service";
import { healthRecordService } from "../src/services/health-records/health-record.service";
import {
    EHealthRecordCategory,
    EHealthRecordStatus,
    ERecordSubject,
} from "../src/types/health-record.types";
import { EUserCategory } from "../src/types/user.types";
import { deriveRiskFlags } from "../src/utils/functions/deriveRiskFlags";

jest.setTimeout(120000);

const ONBOARDING_SLUG = "onboarding-flow-v2";
const ABHA = "12345678901234";

const stubNode = (id: string, next: string | null, overrides: Record<string, unknown> = {}) => ({
    id,
    categoryId: null,
    indicator: id,
    nodeType: "QUESTION_SINGLE",
    text: `old ${id}`,
    educationalMessage: "",
    whyThisMatters: "",
    validWeekStart: null,
    validWeekEnd: null,
    options: [],
    branch: null,
    calc: null,
    next,
    ...overrides,
});

const seedFlow = () =>
    flowDefinitionModel.create({
        slug: ONBOARDING_SLUG,
        name: "Postpartum Onboarding",
        version: 1,
        status: "PUBLISHED",
        startNodeId: "intro",
        nodes: [
            stubNode("intro", "name", { options: [{ label: "old", value: "yes", score: null }] }),
            stubNode("name", "dob", { nodeType: "QUESTION_FREE_TEXT" }),
            stubNode("dob", "delivery_date"),
            stubNode("delivery_date", "pregnancy_conditions"),
            stubNode("pregnancy_conditions", "delivery_outcome"),
            stubNode("delivery_outcome", "parity"),
            stubNode("parity", null, {
                options: [
                    { label: "old first", value: "first_time", score: null },
                    { label: "old more", value: "multiparous", score: null },
                ],
            }),
        ],
        translations: { hi: { name: "hi", nodes: { name: { whyThisMatters: "keep me" } } } },
    });

const chainFrom = (nodes: any[], start: string): string[] => {
    const chain: string[] = [];
    let current: string | null = start;
    while (current) {
        chain.push(current);
        const here: string = current;
        current = nodes.find((node) => node.id === here)?.next ?? null;
    }
    return chain;
};

const answer = async (
    userId: string,
    flow: any,
    nodeId: string,
    input: { freeText?: string; selectedValues?: string[] },
) =>
    new ChatFlowService().updateOnboardingData(
        userId,
        flow,
        nodeId,
        undefined,
        input.freeText,
        input.selectedValues,
    );

describe("PRD section 1 onboarding", () => {
    beforeAll(connectTestDb);
    afterEach(clearTestDb);
    afterAll(closeTestDb);

    describe("flow migration", () => {
        it("puts every question in the agreed order", async () => {
            await seedFlow();
            await migrate();

            const flow = await flowDefinitionModel.findOne({ slug: ONBOARDING_SLUG }).lean();
            expect(chainFrom(flow!.nodes as any[], "intro")).toEqual([
                "intro",
                "name",
                "abha",
                "abha_method",
                "abha_number",
                "abha_card",
                "dob",
                "delivery_date",
                "weight",
                "height",
                "care_model",
                "care_facility",
                "pregnancy_conditions",
                "health_history",
                "delivery_outcome",
                "parity",
                "pregnancies",
                "living_children",
            ]);
        });

        it("rewords existing questions without changing stored answer values", async () => {
            await seedFlow();
            await migrate();

            const flow = await flowDefinitionModel.findOne({ slug: ONBOARDING_SLUG }).lean();
            const nodes = flow!.nodes as any[];
            const parity = nodes.find((node) => node.id === "parity");

            expect(nodes.find((node) => node.id === "intro").text).toContain("Hi, I'm Viva");
            expect(nodes.find((node) => node.id === "name").text).toBe("What is your Name?");
            expect(parity.text).toBe("Is this your first pregnancy?");
            expect(parity.options.map((option: any) => option.value)).toEqual([
                "first_time",
                "multiparous",
            ]);
        });

        it("changes nothing on a second run", async () => {
            await seedFlow();
            await migrate();
            const first = await flowDefinitionModel.findOne({ slug: ONBOARDING_SLUG }).lean();

            await expect(migrate()).resolves.toEqual({ insertedNodes: 0, reworded: 0 });

            const second = await flowDefinitionModel.findOne({ slug: ONBOARDING_SLUG }).lean();
            expect(second!.nodes).toEqual(first!.nodes);
        });

        it("restores its Hindi after add-hindi-translations has replaced the bundle", async () => {
            await seedFlow();
            await migrate();
            await flowDefinitionModel.updateOne(
                { slug: ONBOARDING_SLUG },
                { $set: { "translations.hi": { name: "hi", nodes: {} } } },
            );

            await migrate();

            const flow = await flowDefinitionModel.findOne({ slug: ONBOARDING_SLUG }).lean();
            const hi = (flow as any).translations.hi.nodes;
            expect(hi.care_model.options.private).toBe("निजी अस्पताल");
            expect(hi.intro.text).toContain("नमस्ते, मैं Viva हूँ");
        });

        it("keeps other Hindi on a reworded node", async () => {
            await seedFlow();
            await migrate();

            const flow = await flowDefinitionModel.findOne({ slug: ONBOARDING_SLUG }).lean();
            const hi = (flow as any).translations.hi.nodes;
            expect(hi.name.whyThisMatters).toBe("keep me");
            expect(hi.name.text).toBe("आपका नाम क्या है?");
        });
    });

    describe("saving answers", () => {
        const setup = async () => {
            await seedFlow();
            await migrate();
            const flow = await flowDefinitionModel.findOne({ slug: ONBOARDING_SLUG }).lean();
            const user = await UserModel.create({ user_category: EUserCategory.NP });
            return { flow, userId: String(user._id) };
        };
        const reload = (userId: string) => UserModel.findById(userId).lean();

        it("encrypts the ABHA number and keeps only the last four readable", async () => {
            const { flow, userId } = await setup();

            await answer(userId, flow, "abha_number", { freeText: "1234-5678-9012-34" });

            const raw = await UserModel.findById(userId)
                .select("+onboarding_data.abha_number onboarding_data.abha_number_last4")
                .lean();
            expect(raw!.onboarding_data.abha_number).not.toContain(ABHA);
            expect(decryptField(raw!.onboarding_data.abha_number!)).toBe(ABHA);
            expect(raw!.onboarding_data.abha_number_last4).toBe("1234");
        });

        it("leaves the encrypted number and risk flags out of a normal read", async () => {
            const { flow, userId } = await setup();
            await answer(userId, flow, "abha_number", { freeText: ABHA });
            await refreshRiskFlags(userId);

            const user = JSON.stringify(await reload(userId));

            expect(user).not.toContain('"abha_number":');
            expect(user).not.toContain("risk_flags");
            expect(user).not.toContain("previous_loss");
        });

        it("ignores an ABHA number that is not 14 digits", async () => {
            const { flow, userId } = await setup();

            await answer(userId, flow, "abha_number", { freeText: "12345" });

            expect((await reload(userId))!.onboarding_data.abha_number_last4).toBeNull();
        });

        it("masks the ABHA number for flow responses and chat messages", () => {
            expect(freeTextForStorage("abha_number", ABHA)).toBe("**********1234");
            expect(freeTextForStorage("abha_number", "bad")).toBe("**********");
            expect(freeTextForStorage("abha_card", ABHA)).toBe("**********1234");
            expect(freeTextForStorage("abha_card", "record:abc")).toBe("record:abc");
            expect(freeTextForStorage("location", "Pune")).toBe("Pune");
        });

        it("accepts a typed number on the card question, if the upload did not work", async () => {
            const { flow, userId } = await setup();

            await answer(userId, flow, "abha_card", { freeText: ABHA });

            expect((await reload(userId))!.onboarding_data.abha_number_last4).toBe("1234");
        });

        it("links only her own ABHA card record", async () => {
            const { flow, userId } = await setup();
            const other = await UserModel.create({});
            const base = {
                clientUploadId: "a",
                category: EHealthRecordCategory.ABHA_CARD,
                subject: { type: ERecordSubject.MOTHER, childId: null },
                bucket: "b",
                status: EHealthRecordStatus.READY,
                recordDate: new Date(),
            };
            const theirs = await healthRecordModel.create({ ...base, userId: other._id });
            const hers = await healthRecordModel.create({
                ...base,
                userId,
                clientUploadId: "b",
            });

            await answer(userId, flow, "abha_card", { freeText: `record:${theirs._id}` });
            expect((await reload(userId))!.onboarding_data.abha_record_id).toBeNull();

            await answer(userId, flow, "abha_card", { freeText: `record:${hers._id}` });
            expect(String((await reload(userId))!.onboarding_data.abha_record_id)).toBe(
                String(hers._id),
            );
        });

        it("starts her weight log from the weight answer", async () => {
            const { flow, userId } = await setup();

            await answer(userId, flow, "weight", { freeText: "62.46" });

            const log = await motherLogModel.findOne({ userId, logType: "weight" }).lean();
            expect((log as any).fields.weightKg).toBe(62.5);
            expect((log as any).source).toBe("onboarding");
        });

        it("discards out-of-range measurements", async () => {
            const { flow, userId } = await setup();

            await answer(userId, flow, "weight", { freeText: "900" });
            await answer(userId, flow, "height", { freeText: "20" });
            await answer(userId, flow, "pregnancies", { freeText: "1" });

            const user = await reload(userId);
            expect(await motherLogModel.countDocuments({ userId })).toBe(0);
            expect(user!.onboarding_data.height_cm).toBeNull();
            expect(user!.onboarding_data.pregnancies_count).toBeNull();
        });

        it("saves care model, history and counts", async () => {
            const { flow, userId } = await setup();

            await answer(userId, flow, "height", { freeText: "160" });
            await answer(userId, flow, "care_model", { selectedValues: ["private"] });
            await answer(userId, flow, "health_history", { selectedValues: ["pre_eclampsia"] });
            await answer(userId, flow, "pregnancies", { freeText: "3" });
            await answer(userId, flow, "living_children", { freeText: "0" });

            const data = (await reload(userId))!.onboarding_data;
            expect(data.height_cm).toBe(160);
            expect(data.care_model).toBe("private");
            expect(data.health_history).toEqual(["pre_eclampsia"]);
            expect(data.pregnancies_count).toBe(3);
            expect(data.living_children_count).toBe(0);
        });

        it("treats a skipped care facility as no answer", async () => {
            const { flow, userId } = await setup();

            await answer(userId, flow, "care_facility", { freeText: "City Hospital" });
            expect((await reload(userId))!.onboarding_data.care_facility).toBe("City Hospital");

            await answer(userId, flow, "care_facility", { freeText: SKIP_ANSWER });
            expect((await reload(userId))!.onboarding_data.care_facility).toBeNull();
        });
    });

    describe("ABHA card record", () => {
        const draft = async (category: EHealthRecordCategory, userId: string) =>
            healthRecordModel.create({
                userId,
                clientUploadId: `client-${category}`,
                category,
                subject: { type: ERecordSubject.MOTHER, childId: null },
                bucket: "b",
                status: EHealthRecordStatus.DRAFT,
                recordDate: new Date(),
                files: [
                    {
                        clientUploadId: "page",
                        objectName: "o",
                        kind: "IMAGE",
                        mimeType: "image/jpeg",
                        sizeBytes: 1,
                        sha256: "s",
                    },
                ],
            });

        it("is filed without spending quota or reaching the AI, and stays out of counts", async () => {
            const user = await UserModel.create({});
            const userId = String(user._id);
            const record = await draft(EHealthRecordCategory.ABHA_CARD, userId);
            const consume = jest.spyOn(entitlementService, "consumeCapability");
            const analyze = jest.spyOn((healthRecordService as any).llm, "analyzeRecord");

            const result = await healthRecordService.submit(userId, String(record._id), "en");

            expect(result.record.status).toBe(EHealthRecordStatus.READY);
            expect(consume).not.toHaveBeenCalled();
            expect(analyze).not.toHaveBeenCalled();
            await expect(healthRecordService.readyCount(userId)).resolves.toBe(0);

            consume.mockRestore();
            analyze.mockRestore();
        });

        it("links the card to her profile, and unlinks it when deleted", async () => {
            const user = await UserModel.create({});
            const userId = String(user._id);
            const record = await draft(EHealthRecordCategory.ABHA_CARD, userId);

            await healthRecordService.submit(userId, String(record._id), "en");
            const linked = await UserModel.findById(userId).lean();
            expect(String(linked!.onboarding_data.abha_record_id)).toBe(String(record._id));
            expect(linked!.onboarding_data.abha_status).toBe("yes");

            jest.spyOn(healthRecordService, "purgeObjects").mockResolvedValue(undefined);
            await healthRecordService.deleteMany(userId, [String(record._id)]);
            const unlinked = await UserModel.findById(userId).lean();
            expect(unlinked!.onboarding_data.abha_record_id).toBeNull();
        });
    });

    describe("walking the published flow", () => {
        /** The node order of the live onboarding-flow-v2, with its real indicators. */
        const LIVE_NODES: [string, string][] = [
            ["intro", "Intro"],
            ["name", "Preferred Name"],
            ["dob", "Date of Birth"],
            ["location", "Location"],
            ["delivery_date", "Delivery / Expected Date"],
            ["conception", "Conception Method"],
            ["pregnancy_conditions", "Pregnancy Conditions"],
            ["delivery_type", "Delivery Type"],
            ["delivery_outcome", "Delivery Outcome"],
            ["feeding", "Feeding Method"],
            ["meds_history", "Past Regular Medications"],
            ["current_meds", "Current Regular Medicines"],
            ["smoking", "Tobacco Use"],
            ["alcohol", "Alcohol Use"],
            ["support", "Social Support"],
            ["parity", "Parity"],
        ];

        const seedLiveFlow = () =>
            flowDefinitionModel.create({
                slug: ONBOARDING_SLUG,
                name: "Postpartum Onboarding",
                version: 1,
                status: "PUBLISHED",
                startNodeId: "intro",
                nodes: LIVE_NODES.map(([id, indicator], index) =>
                    stubNode(id, LIVE_NODES[index + 1]?.[0] ?? null, { indicator }),
                ),
            });

        /** Every question she would be asked, using the engine the app runs through. */
        const questionsFor = async (user: Record<string, unknown>) => {
            await seedLiveFlow();
            await migrate();
            const flow = (await flowDefinitionModel
                .findOne({ slug: ONBOARDING_SLUG })
                .lean()) as any;
            const engine = new FlowService();
            const asked: string[] = [];
            let current: string | null = flow.startNodeId;
            while (current) {
                const next: string | null = await engine.findNextValidNode(
                    user as any,
                    {} as any,
                    flow,
                    current,
                    1,
                );
                if (!next) break;
                asked.push(next);
                current = flow.nodes.find((node: any) => node.id === next).next;
            }
            return asked;
        };

        const COMMON_START = ["intro", "name", "abha", "dob", "location", "delivery_date"];
        const MEASURES = ["weight", "height", "care_model"];

        it("asks a pregnant mother with an earlier pregnancy everything that applies", async () => {
            const asked = await questionsFor({
                _id: "u",
                user_category: EUserCategory.NP,
                onboarding_data: {
                    abha_status: "yes",
                    abha_capture_method: "type",
                    parity: "multiparous",
                },
            });

            expect(asked).toEqual([
                "intro",
                "name",
                "abha",
                "abha_method",
                "abha_number",
                "dob",
                "location",
                "delivery_date",
                ...MEASURES,
                "care_facility",
                "conception",
                "pregnancy_conditions",
                "health_history",
                "meds_history",
                "current_meds",
                "smoking",
                "alcohol",
                "support",
                "parity",
                "pregnancies",
                "living_children",
            ]);
        });

        it("skips counts and the ABHA follow-ups for a first-time postpartum mother", async () => {
            const asked = await questionsFor({
                _id: "u",
                user_category: EUserCategory.PP,
                onboarding_data: { abha_status: "no", parity: "first_time" },
            });

            expect(asked).toEqual(expect.arrayContaining(["delivery_type", "feeding", "parity"]));
            for (const hidden of ["abha_method", "abha_number", "abha_card"]) {
                expect(asked).not.toContain(hidden);
            }
            expect(asked).not.toContain("pregnancies");
            expect(asked).not.toContain("living_children");
        });

        it("shows only the basics to a woman who is not pregnant", async () => {
            const asked = await questionsFor({
                _id: "u",
                user_category: EUserCategory.NN,
                onboarding_data: { abha_status: "skip" },
            });

            expect(asked).toEqual([
                ...COMMON_START,
                ...MEASURES,
                "meds_history",
                "current_meds",
                "smoking",
                "alcohol",
            ]);
        });

        it("asks for her care route before a stillbirth answer can end the flow", async () => {
            const asked = await questionsFor({
                _id: "u",
                user_category: EUserCategory.PP,
                onboarding_data: { abha_status: "no" },
            });

            expect(asked.indexOf("care_model")).toBeLessThan(asked.indexOf("delivery_outcome"));
            expect(asked.indexOf("care_facility")).toBeLessThan(asked.indexOf("delivery_outcome"));
        });
    });

    describe("who sees which question", () => {
        it("asks pregnancy counts only when this is not her first", () => {
            for (const indicator of ["Pregnancy Count", "Living Children"]) {
                expect(isOnboardingNodeUnlocked(indicator, { parity: "multiparous" })).toBe(true);
                expect(isOnboardingNodeUnlocked(indicator, { parity: "first_time" })).toBe(false);
                expect(isOnboardingNodeUnlocked(indicator, {})).toBe(false);
            }
        });

        it("follows the ABHA answers", () => {
            const data = { abha_status: "yes", abha_capture_method: "type" };
            expect(isOnboardingNodeUnlocked("ABHA Method", data)).toBe(true);
            expect(isOnboardingNodeUnlocked("ABHA Number", data)).toBe(true);
            expect(isOnboardingNodeUnlocked("ABHA Card", data)).toBe(false);
            expect(isOnboardingNodeUnlocked("ABHA Method", { abha_status: "skip" })).toBe(false);
            expect(isOnboardingNodeUnlocked("ABHA Number", { abha_status: "no" })).toBe(false);
        });

        it("leaves other questions alone", () => {
            expect(isOnboardingNodeUnlocked("Weight", null)).toBe(true);
            expect(isOnboardingNodeUnlocked("Lochia / Bleeding", undefined)).toBe(true);
        });

        it("shows not-pregnant women the basics only", () => {
            for (const hidden of [
                "Care Facility",
                "Health History",
                "Pregnancy Count",
                "Living Children",
            ]) {
                expect(NN_WOMEN_INDICATORS).toContain(hidden);
            }
            for (const shown of ["ABHA", "Weight", "Height", "Care Model"]) {
                expect(NN_WOMEN_INDICATORS).not.toContain(shown);
            }
        });
    });

    describe("deriveRiskFlags", () => {
        const flags = (category: EUserCategory, data: Record<string, unknown>) =>
            deriveRiskFlags({ user_category: category, onboarding_data: data });

        it("does not read a current pregnancy as a loss", () => {
            expect(
                flags(EUserCategory.NP, { pregnancies_count: 2, living_children_count: 1 })
                    .previous_loss,
            ).toBe(false);
        });

        it("flags a loss when completed pregnancies outnumber living children", () => {
            expect(
                flags(EUserCategory.NP, { pregnancies_count: 3, living_children_count: 1 })
                    .previous_loss,
            ).toBe(true);
            expect(
                flags(EUserCategory.PP, { pregnancies_count: 2, living_children_count: 1 })
                    .previous_loss,
            ).toBe(true);
        });

        it("accepts more living children than pregnancies, as with twins", () => {
            expect(
                flags(EUserCategory.PP, { pregnancies_count: 2, living_children_count: 3 })
                    .previous_loss,
            ).toBe(false);
        });

        it("raises no loss flag while the counts are unknown", () => {
            expect(flags(EUserCategory.PP, {}).previous_loss).toBe(false);
        });

        it("flags a stillbirth as a loss", () => {
            expect(flags(EUserCategory.PP, { delivery_outcome: "still_birth" }).previous_loss).toBe(
                true,
            );
        });

        it("reads condition flags from onboarding answers", () => {
            const result = flags(EUserCategory.NP, {
                pregnancy_conditions: ["gestational_diabetes"],
                past_medications: ["history_anemia"],
                health_history: ["pre_eclampsia"],
            });
            expect(result.prior_gdm).toBe(true);
            expect(result.anaemia_history).toBe(true);
            expect(result.pregnancy_hypertension).toBe(true);
        });

        it("uses the age and parity thresholds", () => {
            const now = new Date("2026-11-04");
            const of = (dob: string, pregnancies: number) =>
                deriveRiskFlags(
                    {
                        user_category: EUserCategory.NP,
                        onboarding_data: { date_of_birth: dob, pregnancies_count: pregnancies },
                    },
                    now,
                );
            expect(of("1985-01-01", 5)).toMatchObject({ age_risk: true, high_parity: true });
            expect(of("2000-01-01", 4)).toMatchObject({ age_risk: false, high_parity: false });
        });
    });

    describe("Edit Profile patch", () => {
        it("drops fields only the server may set", () => {
            const patch: Record<string, any> = {
                risk_flags: { previous_loss: false },
                abha_number_last4: "9999",
                abha_record_id: "abc",
            };
            expect(sanitizeOnboardingPatch(patch)).toBeNull();
            expect(patch).toEqual({});
        });

        it("encrypts a new ABHA number", () => {
            const patch: Record<string, any> = { abha_number: ABHA };
            expect(sanitizeOnboardingPatch(patch)).toBeNull();
            expect(decryptField(patch.abha_number)).toBe(ABHA);
            expect(patch.abha_number_last4).toBe("1234");
            expect(patch.abha_status).toBe("yes");
        });

        it("clears an ABHA number on null", () => {
            const patch: Record<string, any> = { abha_number: null };
            expect(sanitizeOnboardingPatch(patch)).toBeNull();
            expect(patch.abha_number_last4).toBeNull();
        });

        it.each([
            [{ abha_number: "123" }],
            [{ care_facility: 5 }],
            [{ care_facility: "x".repeat(121) }],
            [{ health_history: ["not_a_value"] }],
            [{ pregnancies_count: 1 }],
            [{ pregnancies_count: 2.5 }],
            [{ living_children_count: -1 }],
        ])("rejects %j", (patch) => {
            expect(sanitizeOnboardingPatch(patch)).not.toBeNull();
        });
    });

    describe("partial update response", () => {
        it("leaves out the encrypted number and risk flags", async () => {
            const user = await UserModel.create({
                onboarding_data: {
                    abha_number: encryptField(ABHA),
                    risk_flags: { previous_loss: true },
                },
            });

            const updated = await new UserService().findByIdAndPartialUpdate({
                _id: String(user._id),
                payload: { onboarding_data: { care_facility: "City Hospital" } } as any,
            });

            const json = JSON.stringify(updated);
            expect(json).toContain("City Hospital");
            expect(json).not.toContain('"abha_number":');
            expect(json).not.toContain("previous_loss");
        });
    });

    describe("field encryption", () => {
        it("gives the same value a different ciphertext each time", () => {
            expect(encryptField(ABHA)).not.toBe(encryptField(ABHA));
        });

        it("rejects a tampered value", () => {
            const stored = Buffer.from(encryptField(ABHA), "base64");
            stored[stored.length - 1]! ^= 1;
            expect(() => decryptField(stored.toString("base64"))).toThrow();
        });
    });
});
