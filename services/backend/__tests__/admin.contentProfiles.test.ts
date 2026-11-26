/**
 * Content search profiles: nothing becomes suggestible without an admin's approval of
 * exactly what they saw, and an edit to the content withdraws it.
 *
 * Run:  npx jest admin.contentProfiles
 */
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

jest.mock(require.resolve("../src/config/firebase"), () => ({ __esModule: true, default: null }));
jest.mock(require.resolve("../src/config/redis.config"), () => ({
    __esModule: true,
    redisPublisher: null,
    redisSubscriber: null,
}));
jest.mock("razorpay", () =>
    jest.fn().mockImplementation(() => ({
        orders: { create: jest.fn(), fetch: jest.fn() },
        payments: { fetch: jest.fn() },
    })),
);
jest.mock(require.resolve("../src/utils/sendPushNotification"), () => ({
    __esModule: true,
    sendPushNotification: jest.fn().mockResolvedValue(undefined),
}));
const mockDraft = jest.fn();
jest.mock(require.resolve("../src/services/llm/llm.service"), () => ({
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
        draftContentProfile: (...args: unknown[]) => mockDraft(...args),
    })),
}));

import request from "supertest";
import bcrypt from "bcryptjs";
import app from "../src/app";
import contentModel from "../src/models/content.model";
import profileModel from "../src/models/content-search-profile.model";
import userModel from "../src/models/user.model";
import { EUserRole } from "../src/types";
import { generateJWT } from "../src/utils/functions/generateJWT";
import { connectTestDb, closeTestDb, clearTestDb } from "./helpers/db";

const BASE = "/api/v1/admin/content-profiles";
const VIDEO = "https://youtu.be/abc123";
const DRAFT = {
    request_id: "r",
    status: "DRAFTED",
    video_checked: true,
    profile: {
        summary: "Explains how to care for stitches after birth.",
        one_liner: "Caring for stitches.",
        keywords_en: ["stitches"],
        keywords_hi: ["tanke"],
        example_questions: [{ text: "tanke me dard?", language: "hinglish", timestamp: "1:20" }],
        suitable_for: ["PP"],
    },
};

describe("content search profiles", () => {
    let token: string;
    let contentId: string;

    beforeAll(connectTestDb);
    afterAll(closeTestDb);
    afterEach(async () => {
        await clearTestDb();
        mockDraft.mockReset();
    });

    beforeEach(async () => {
        mockDraft.mockResolvedValue(DRAFT);
        await userModel.create({
            email: "a@vivamama.app",
            password: await bcrypt.hash("correct-horse", 4),
            role: EUserRole.SUPER_ADMIN,
        });
        const res = await request(app)
            .post("/api/v1/admin/auth/login")
            .send({ email: "a@vivamama.app", password: "correct-horse" });
        token = res.body.data.token;
        const content = await contentModel.create({
            featuredImage: "i",
            featuredTitle: "Stitches",
            category: ["PP", "NP"],
            validWeekStart: 1,
            validWeekEnd: 52,
            contentBody: [
                { contentType: "PARAGRAPH", body: "Keep it clean." },
                { contentType: "IMAGE", body: "x.png" },
                { contentType: "VIDEO", body: VIDEO },
            ],
        });
        contentId = String(content._id);
    });

    const call = (method: "get" | "post" | "put", path = "", body?: object) =>
        request(app)[method](`${BASE}${path}`).set("Authorization", `Bearer ${token}`).send(body);
    const generate = (revision = 0) => call("post", `/${contentId}/generate`, { revision });
    const approve = (view: any, over = {}) =>
        call("post", `/${contentId}/approve`, {
            revision: view.profile.revision,
            sourceHash: view.content.sourceHash,
            ...over,
        });
    const edits = (view: any) => ({
        revision: view.profile?.revision ?? 0,
        sourceHash: view.content.sourceHash,
        summary: "A summary an admin wrote by hand.",
        oneLiner: "By hand.",
        keywordsEn: [],
        keywordsHi: [],
        exampleQuestions: [],
        suitableFor: ["PP", "NN"],
    });
    const state = async () => (await call("get")).body.data[0].state;

    it("refuses a patient token on every route, including creating content", async () => {
        const patient = await userModel.create({
            mobile_number: "9990001111",
            role: EUserRole.USER,
        });
        token = generateJWT(patient as any) as string;
        expect((await call("get")).status).toBe(403);
        expect((await generate()).status).toBe(403);
        expect((await call("put", `/${contentId}`, {})).status).toBe(403);
        expect((await call("post", `/${contentId}/approve`, {})).status).toBe(403);
        const create = await request(app)
            .post("/api/v1/admin/contents")
            .set("Authorization", `Bearer ${token}`)
            .send({
                featuredImage: "i",
                featuredTitle: "Injected",
                category: ["PP"],
                validWeekStart: 1,
                validWeekEnd: 2,
            });
        expect(create.status).toBe(403);
        expect(await contentModel.countDocuments()).toBe(1);
    });

    it("lists a content that has no summary yet", async () => {
        const res = await call("get");
        expect(res.body.data).toHaveLength(1);
        expect(res.body.data[0]).toMatchObject({ state: "NO_SUMMARY", mediaType: "MIXED" });
    });

    it("sends text and video, drafts, then approves", async () => {
        const drafted = await generate();
        expect(mockDraft).toHaveBeenCalledWith({
            content_id: contentId,
            title: "Stitches",
            text: "Keep it clean.",
            video_urls: [VIDEO],
        });
        expect(drafted.body.data.state).toBe("DRAFT");
        const approved = await approve(drafted.body.data);
        expect(approved.status).toBe(200);
        expect(approved.body.data.state).toBe("APPROVED");
        expect((await profileModel.findOne())!.approvedBy).toBeTruthy();
    });

    it("withdraws approval when the content is edited straight in the database", async () => {
        await approve((await generate()).body.data);
        await contentModel.collection.updateOne({}, { $set: { featuredTitle: "Changed" } });
        expect(await state()).toBe("NEEDS_REVIEW");
    });

    it("does not withdraw approval for an image change", async () => {
        await approve((await generate()).body.data);
        await contentModel.collection.updateOne({}, { $set: { "contentBody.1.body": "y.png" } });
        expect(await state()).toBe("APPROVED");
    });

    it("refuses to approve content that changed while it was being reviewed", async () => {
        const view = (await generate()).body.data;
        await contentModel.collection.updateOne({}, { $set: { featuredTitle: "Changed" } });
        expect((await approve(view)).body.data.code).toBe("CONTENT_CHANGED");
        const fresh = (await call("get", `/${contentId}`)).body.data;
        expect((await approve(fresh)).body.data.code).toBe("PROFILE_OUTDATED");
    });

    it("sends an approved summary back to draft when it is edited", async () => {
        const view = (await approve((await generate()).body.data)).body.data;
        const saved = await call("put", `/${contentId}`, edits(view));
        expect(saved.body.data.state).toBe("DRAFT");
        expect(saved.body.data.profile.approvedAt).toBeNull();
    });

    it("stops claiming the video was checked once the content has changed", async () => {
        await approve((await generate()).body.data);
        await contentModel.collection.updateOne(
            {},
            { $set: { "contentBody.2.body": "https://youtu.be/other" } },
        );
        const fresh = (await call("get", `/${contentId}`)).body.data;
        const saved = (await call("put", `/${contentId}`, edits(fresh))).body.data;
        expect(saved.state).toBe("DRAFT");
        expect(saved.profile.videoChecked).toBe(false);
        expect((await approve(saved)).body.data.state).toBe("APPROVED");
    });

    it("never lets an older view overwrite a newer one", async () => {
        const view = (await generate()).body.data;
        expect((await call("put", `/${contentId}`, edits(view))).status).toBe(200);
        expect((await call("put", `/${contentId}`, edits(view))).status).toBe(409);
        expect((await approve(view)).status).toBe(409);
        mockDraft.mockClear();
        expect((await generate(1)).status).toBe(409);
        expect(mockDraft).not.toHaveBeenCalled();
    });

    it("keeps an edit made while a redraft was running", async () => {
        const view = (await generate()).body.data;
        mockDraft.mockImplementation(async () => {
            await call("put", `/${contentId}`, edits(view));
            return DRAFT;
        });
        expect((await generate(1)).status).toBe(409);
        expect((await profileModel.findOne())!.oneLiner).toBe("By hand.");
    });

    it("lets an admin write one by hand when nothing could be read", async () => {
        mockDraft.mockResolvedValue({ request_id: "r", status: "NEEDS_MANUAL" });
        const view = (await generate()).body.data;
        expect(view.state).toBe("NEEDS_MANUAL");
        expect((await approve(view)).body.data.code).toBe("PROFILE_INCOMPLETE");
        const saved = (await call("put", `/${contentId}`, edits(view))).body.data;
        expect((await approve(saved)).body.data.state).toBe("APPROVED");
    });

    it("refuses to approve without a suitable stage", async () => {
        const view = (await generate()).body.data;
        const saved = (await call("put", `/${contentId}`, { ...edits(view), suitableFor: [] })).body
            .data;
        expect((await approve(saved)).body.data.code).toBe("PROFILE_INCOMPLETE");
    });

    it("reports a chatbot failure as 502 and stores nothing", async () => {
        mockDraft.mockRejectedValue(new Error("down"));
        expect((await generate()).status).toBe(502);
        expect(await profileModel.countDocuments()).toBe(0);
    });

    it("rejects bad ids and unknown content", async () => {
        expect((await call("get", "/nope")).status).toBe(400);
        expect((await call("get", "/6a9f23daf4324a08644d1e4e")).status).toBe(404);
    });
});
