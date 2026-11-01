/**
 * Reports, scans and prescriptions attached in Viva AI chat.
 *
 * What has to hold: a file is checked by its content and cleaned before anything is
 * stored; only she can ever read or send it; refused files are deleted and cost her
 * nothing; a turn is paid for once however often the app retries it; and when
 * anything fails she gets her question back and the app is told.
 *
 * Real sharp and pdf-lib on generated fixtures, in-memory Mongo, fake storage.
 *
 * Run:  npx jest chatAttachments
 */

jest.mock(require.resolve("../src/config/firebase"), () => ({ __esModule: true, default: null }));
jest.mock(require.resolve("../src/config/redis.config"), () => ({ __esModule: true }));
jest.mock("razorpay", () =>
    jest.fn().mockImplementation(() => ({ orders: { create: jest.fn() } })),
);
const mockSendUserQuery = jest.fn();
jest.mock("../src/services/llm/llm.service", () => ({
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
        sendUserQuery: mockSendUserQuery,
        sendNameQuery: jest.fn(),
    })),
}));

import { randomUUID } from "crypto";
import { crc32 } from "zlib";

import jwt from "jsonwebtoken";
import { Types } from "mongoose";
import { PDFDocument } from "pdf-lib";
import sharp from "sharp";
import request from "supertest";

import { clearTestDb, closeTestDb, connectTestDb } from "./helpers/db";
import { createFakeGcs } from "./helpers/fakeGcs";
import app from "../src/app";
import env from "../src/config/env";
import { setStorageForTests } from "../src/config/gcs.config";
import { chatAttachmentJanitor } from "../src/cron-jobs/chatAttachmentJanitor";
import chatAttachmentModel from "../src/models/chat-attachment.model";
import messageModel from "../src/models/message.model";
import motherLogModel from "../src/models/mother-log.model";
import pendingGcsPurgeModel from "../src/models/pending-gcs-purge.model";
import usageCounterModel from "../src/models/usage-counter.model";
import UserModel from "../src/models/user.model";
import sseBus from "../src/services/chat-system/sse-bus.service";
import { entitlementService } from "../src/services/entitlements/entitlement.service";
import { EQuotaWindow } from "../src/services/entitlements/entitlement.config";
import { EUsageCounterKey } from "../src/types/subscription.types";
import { EAttachmentStatus } from "../src/types/chat-attachment.types";
import { MessageRoleEnum } from "../src/types/chat.types";
import { EUserCategory } from "../src/types/user.types";

jest.setTimeout(120000);

const gcs = createFakeGcs();
setStorageForTests(gcs.storage);

beforeAll(connectTestDb);
afterAll(closeTestDb);
beforeEach(() => {
    mockSendUserQuery.mockReset();
    gcs.objects.clear();
});
afterEach(clearTestDb);

// ── Fixtures ──────────────────────────────────────────────────────────────────────

const jpegWithExif = () =>
    sharp({ create: { width: 1200, height: 900, channels: 3, background: "#f5f5f5" } })
        .withExif({ IFD0: { Copyright: "secret-device-owner", Software: "PhoneCam 1.0" } })
        .jpeg()
        .toBuffer();
const png = (w = 800, h = 600) =>
    sharp({ create: { width: w, height: h, channels: 3, background: "#ffffff" } })
        .png()
        .toBuffer();
const webp = () =>
    sharp({ create: { width: 800, height: 600, channels: 3, background: "#eeeeee" } })
        .webp()
        .toBuffer();

/** A small PNG whose header claims 20,000 x 20,000 pixels: a decompression bomb. */
const pngBomb = async () => {
    const buf = Buffer.from(await png(400, 400));
    // IHDR data starts after signature(8) + length(4) + "IHDR"(4).
    buf.writeUInt32BE(20000, 16);
    buf.writeUInt32BE(20000, 20);
    buf.writeUInt32BE(crc32(buf.subarray(12, 29)) >>> 0, 29);
    return buf;
};
const pdf = async (pages = 1, extra = "") => {
    const doc = await PDFDocument.create();
    for (let i = 0; i < pages; i++) doc.addPage([595, 842]).drawText(`Haemoglobin 11.2 g/dL`);
    return Buffer.concat([Buffer.from(await doc.save()), Buffer.from(extra, "latin1")]);
};
const heic = () =>
    Buffer.concat([
        Buffer.from([0, 0, 0, 0x18]),
        Buffer.from("ftypheic", "latin1"),
        Buffer.alloc(64),
    ]);
const exe = () => Buffer.concat([Buffer.from("MZ", "latin1"), Buffer.alloc(512, 1)]);

// ── Helpers ───────────────────────────────────────────────────────────────────────

async function createMother({ consent = true } = {}) {
    const user = await UserModel.create({
        mobile_number: `9${Math.floor(100000000 + Math.random() * 899999999)}`,
        user_category: EUserCategory.NP,
        onboarding_data: { preferred_name: "Asha" },
        ...(consent
            ? {
                  chat_attachment_consent: {
                      version: env.CHAT_ATTACHMENT_CONSENT_VERSION,
                      acceptedAt: new Date(),
                  },
              }
            : {}),
    });
    const userId = user._id.toString();
    return { userId, auth: `Bearer ${jwt.sign({ _id: userId }, env.JWT_SECRET as string)}` };
}

const upload = (auth: string, file: Buffer, name = "report.jpg", clientUploadId = randomUUID()) =>
    request(app)
        .post("/api/v1/chat/attachments")
        .set("Authorization", auth)
        .field("clientUploadId", clientUploadId)
        .attach("file", file, name);

async function uploaded(auth: string, file?: Buffer, name?: string) {
    const res = await upload(auth, file ?? (await jpegWithExif()), name);
    expect(res.status).toBe(201);
    return res.body.data.attachment.id as string;
}

const answer = (auth: string, body: Record<string, unknown>) =>
    request(app)
        .post("/api/v1/chat-flow/answer")
        .set("Authorization", auth)
        .send({ flowType: "CHATBOT", flowInstanceId: "chatbot", nodeId: "chatbot", ...body });

async function waitFor<T>(
    probe: () => Promise<T | null | undefined | false>,
    ms = 5000,
): Promise<T> {
    const started = Date.now();
    for (;;) {
        const value = await probe();
        if (value) return value;
        if (Date.now() - started > ms) throw new Error("waitFor timed out");
        await new Promise((r) => setTimeout(r, 25));
    }
}

const aiUsed = async (userId: string) =>
    (await usageCounterModel.findOne({ user_id: userId }).lean())?.count ?? 0;

const analyzed = (extra: Record<string, unknown> = {}) => ({
    answer: "**What this is**\nA blood test report.",
    intent: "ATTACHMENT_ANALYSIS",
    attachment: {
        verdict: "ANALYZED",
        category: "lab_report",
        subject: "mother",
        reason_code: "OK",
    },
    quota_refund: false,
    final_prompt: "SYSTEM: secret profile and context",
    ...extra,
});

// ── Upload ────────────────────────────────────────────────────────────────────────

describe("POST /chat/attachments", () => {
    it("asks for consent before the first upload, without ending her session", async () => {
        const { auth } = await createMother({ consent: false });

        const res = await upload(auth, await jpegWithExif());

        expect(res.status).toBe(403);
        // The app logs out on a 403 without a string data.code.
        expect(res.body.data.code).toBe("ATTACHMENT_CONSENT_REQUIRED");
        expect(gcs.keys()).toHaveLength(0);
    });

    it("records consent for the current version only", async () => {
        const { userId, auth } = await createMother({ consent: false });

        const stale = await request(app)
            .post("/api/v1/chat/attachments/consent")
            .set("Authorization", auth)
            .send({ consentVersion: "2020-01-v0" });
        expect(stale.status).toBe(409);

        const ok = await request(app)
            .post("/api/v1/chat/attachments/consent")
            .set("Authorization", auth)
            .send({ consentVersion: env.CHAT_ATTACHMENT_CONSENT_VERSION });
        expect(ok.status).toBe(200);
        const user = await UserModel.findById(userId).lean();
        expect(user?.chat_attachment_consent?.version).toBe(env.CHAT_ATTACHMENT_CONSENT_VERSION);
    });

    it("stores a cleaned JPEG under her own prefix, with the metadata stripped", async () => {
        const { userId, auth } = await createMother();

        const res = await upload(auth, await jpegWithExif(), "IMG_2041.jpg");

        expect(res.status).toBe(201);
        const view = res.body.data.attachment;
        expect(view).toMatchObject({ kind: "IMAGE", mimeType: "image/jpeg", originalName: null });
        expect(view.previewUrl).toMatch(/^https:\/\//);

        const [key] = gcs.keys();
        expect(key).toMatch(
            new RegExp(`^${env.CHAT_ATTACHMENTS_BUCKET}/chat/${userId}/[0-9a-f-]+\\.jpg$`),
        );
        const meta = await sharp(gcs.objects.get(key)!.data).metadata();
        expect(meta.format).toBe("jpeg");
        expect(meta.exif).toBeUndefined();
        // Nothing about where the URL points is kept on the record.
        const record = await chatAttachmentModel.findById(view.id).lean();
        expect(JSON.stringify(record)).not.toContain("https://");
    });

    it("accepts PNG, WebP and PDF, keeping the PDF's name for her card", async () => {
        const { auth } = await createMother();

        expect((await upload(auth, await png(), "a.png")).status).toBe(201);
        expect((await upload(auth, await webp(), "a.webp")).status).toBe(201);
        const res = await upload(auth, await pdf(2), "../../CBC Report.pdf");
        expect(res.status).toBe(201);
        expect(res.body.data.attachment).toMatchObject({
            kind: "PDF",
            pageCount: 2,
            originalName: "CBC Report.pdf",
        });
    });

    it("returns the first record when the same upload is retried", async () => {
        const { auth } = await createMother();
        const id = randomUUID();
        const file = await jpegWithExif();

        const first = await upload(auth, file, "a.jpg", id);
        const second = await upload(auth, file, "a.jpg", id);

        expect(first.status).toBe(201);
        expect(second.status).toBe(200);
        expect(second.body.data.attachment.id).toBe(first.body.data.attachment.id);
        expect(gcs.keys()).toHaveLength(1);
    });

    it.each([
        ["an executable renamed to .jpg", exe, "photo.jpg", 415, "ATTACHMENT_UNSUPPORTED_TYPE"],
        ["a HEIC photo", heic, "photo.heic", 415, "ATTACHMENT_UNSUPPORTED_TYPE"],
        ["a decompression bomb", pngBomb, "bomb.png", 422, "ATTACHMENT_IMAGE_TOO_LARGE_DIMENSIONS"],
        ["a tiny image", () => png(100, 80), "tiny.png", 422, "ATTACHMENT_IMAGE_TOO_SMALL"],
        ["an 11-page PDF", () => pdf(11), "big.pdf", 422, "ATTACHMENT_PDF_TOO_MANY_PAGES"],
        [
            "a password-protected PDF",
            () => pdf(1, "\ntrailer << /Encrypt 5 0 R >>\n"),
            "locked.pdf",
            422,
            "ATTACHMENT_PDF_ENCRYPTED",
        ],
        [
            "a PDF with a launch action",
            () => pdf(1, "\n<< /S /Launch /F (cmd.exe) >>\n"),
            "evil.pdf",
            422,
            "ATTACHMENT_PDF_UNSAFE",
        ],
        [
            "a truncated JPEG",
            async () => (await jpegWithExif()).subarray(0, 400),
            "cut.jpg",
            422,
            "ATTACHMENT_CORRUPT",
        ],
    ])("refuses %s and stores nothing", async (_label, make, name, status, code) => {
        const { auth } = await createMother();

        const res = await upload(
            auth,
            await (make as () => Promise<Buffer> | Buffer)(),
            name as string,
        );

        expect(res.status).toBe(status);
        expect(res.body.data.code).toBe(code);
        expect(gcs.keys()).toHaveLength(0);
        expect(await chatAttachmentModel.countDocuments({})).toBe(0);
    });

    it("refuses a file over the size limit before reading it", async () => {
        const { auth } = await createMother();
        const res = await upload(
            auth,
            Buffer.alloc(env.CHAT_ATTACHMENT_MAX_BYTES + 1, 0xff),
            "x.jpg",
        );
        expect(res.status).toBe(413);
        expect(res.body.data.code).toBe("ATTACHMENT_TOO_LARGE");
    });

    it("caps uploads per day", async () => {
        const { auth } = await createMother();
        const before = env.CHAT_ATTACHMENT_DAILY_LIMIT;
        (env as { CHAT_ATTACHMENT_DAILY_LIMIT: number }).CHAT_ATTACHMENT_DAILY_LIMIT = 2;
        try {
            const file = await png();
            expect((await upload(auth, file)).status).toBe(201);
            expect((await upload(auth, file)).status).toBe(201);
            const third = await upload(auth, file);
            expect(third.status).toBe(429);
            expect(third.body.data.code).toBe("ATTACHMENT_DAILY_LIMIT");
        } finally {
            (env as { CHAT_ATTACHMENT_DAILY_LIMIT: number }).CHAT_ATTACHMENT_DAILY_LIMIT = before;
        }
    });

    it("is off for users outside the rollout, and says so in config", async () => {
        const { auth } = await createMother();
        const before = env.CHAT_ATTACHMENTS_ROLLOUT_PERCENT;
        (env as { CHAT_ATTACHMENTS_ROLLOUT_PERCENT: number }).CHAT_ATTACHMENTS_ROLLOUT_PERCENT = 0;
        try {
            const res = await upload(auth, await png());
            expect(res.status).toBe(403);
            expect(res.body.data.code).toBe("FEATURE_DISABLED");

            const config = await request(app)
                .get("/api/v1/chat/attachments/config")
                .set("Authorization", auth);
            expect(config.status).toBe(200);
            expect(config.body.data.enabled).toBe(false);
        } finally {
            (env as { CHAT_ATTACHMENTS_ROLLOUT_PERCENT: number }).CHAT_ATTACHMENTS_ROLLOUT_PERCENT =
                before;
        }
    });

    it("reports limits and consent in config", async () => {
        const { auth } = await createMother();
        await uploaded(auth);

        const res = await request(app)
            .get("/api/v1/chat/attachments/config")
            .set("Authorization", auth);

        expect(res.body.data).toMatchObject({
            enabled: true,
            maxPerTurn: 3,
            retentionDays: 90,
            consentAccepted: true,
            remainingToday: env.CHAT_ATTACHMENT_DAILY_LIMIT - 1,
        });
    });
});

// ── Reading and deleting ──────────────────────────────────────────────────────────

describe("GET /chat/attachments/:id/url and DELETE", () => {
    it("signs a short-lived link for her file only", async () => {
        const her = await createMother();
        const other = await createMother();
        const id = await uploaded(her.auth);

        const mine = await request(app)
            .get(`/api/v1/chat/attachments/${id}/url`)
            .set("Authorization", her.auth);
        expect(mine.status).toBe(200);
        const ttl = new Date(mine.body.data.expiresAt).getTime() - Date.now();
        expect(ttl).toBeLessThanOrEqual(env.CHAT_ATTACHMENT_SIGNED_URL_TTL_SEC * 1000);

        // Not 403: another user must not learn the id exists.
        const theirs = await request(app)
            .get(`/api/v1/chat/attachments/${id}/url`)
            .set("Authorization", other.auth);
        expect(theirs.status).toBe(404);
    });

    it("deletes the file and answers 410 afterwards", async () => {
        const { auth } = await createMother();
        const id = await uploaded(auth);

        const del = await request(app)
            .delete(`/api/v1/chat/attachments/${id}`)
            .set("Authorization", auth);
        expect(del.status).toBe(200);
        expect(gcs.keys()).toHaveLength(0);

        const after = await request(app)
            .get(`/api/v1/chat/attachments/${id}/url`)
            .set("Authorization", auth);
        expect(after.status).toBe(410);
        expect(after.body.data.code).toBe("ATTACHMENT_EXPIRED");
    });

    it("answers 410 once retention has passed", async () => {
        const { auth } = await createMother();
        const id = await uploaded(auth);
        await chatAttachmentModel.updateOne(
            { _id: id },
            { expiresAt: new Date(Date.now() - 1000) },
        );

        const res = await request(app)
            .get(`/api/v1/chat/attachments/${id}/url`)
            .set("Authorization", auth);
        expect(res.status).toBe(410);
    });
});

// ── Sending with a turn ───────────────────────────────────────────────────────────

describe("POST /chat-flow/answer with attachments", () => {
    let published: Array<{ userId: string; payload: Record<string, unknown> }>;
    beforeEach(() => {
        published = [];
        jest.spyOn(sseBus, "publish").mockImplementation(async (userId, payload) => {
            published.push({ userId, payload });
            return true;
        });
    });
    afterEach(() => jest.restoreAllMocks());

    const replyFor = (clientMessageId: string) =>
        waitFor(async () => published.find((p) => p.payload.replyTo === clientMessageId));

    it("sends her file to the chatbot by reference and keeps it once accepted", async () => {
        const { userId, auth } = await createMother();
        const id = await uploaded(auth);
        mockSendUserQuery.mockResolvedValue(analyzed());
        const clientMessageId = randomUUID();

        const res = await answer(auth, {
            freeText: "",
            attachmentIds: [id],
            clientMessageId,
            lang: "hi-IN",
        });
        expect(res.status).toBe(200);
        const { payload } = await replyFor(clientMessageId);

        const [, text, , , options] = mockSendUserQuery.mock.calls[0];
        expect(text).toBe("");
        expect(options.lang).toBe("hi");
        expect(options.attachments).toEqual([
            expect.objectContaining({
                attachment_id: id,
                kind: "image",
                mime_type: "image/jpeg",
                uri: expect.stringMatching(
                    new RegExp(`^gs://${env.CHAT_ATTACHMENTS_BUCKET}/chat/${userId}/`),
                ),
            }),
        ]);

        const turn = await messageModel.findOne({ userId, role: MessageRoleEnum.USER }).lean();
        expect(turn?.attachments).toEqual([
            expect.objectContaining({ kind: "IMAGE", mimeType: "image/jpeg" }),
        ]);
        expect(String(turn?.attachments?.[0]?.attachmentId)).toBe(id);
        expect((await chatAttachmentModel.findById(id).lean())?.status).toBe(
            EAttachmentStatus.ANALYZED,
        );
        expect(gcs.keys()).toHaveLength(1);
        expect(await aiUsed(userId)).toBe(1);

        // What reaches the phone is a whitelist: never the prompt.
        expect(JSON.stringify(payload)).not.toContain("secret profile");
        expect(payload.attachment).toEqual({ verdict: "ANALYZED", reasonCode: "OK" });
    });

    it("deletes a refused file at once and gives her question back", async () => {
        const { userId, auth } = await createMother();
        const id = await uploaded(auth);
        mockSendUserQuery.mockResolvedValue({
            answer: "I can only help with health documents about your pregnancy…",
            intent: "ATTACHMENT_REJECTED",
            attachment: {
                verdict: "UNRELATED",
                category: "non_medical",
                subject: null,
                reason_code: "NOT_HEALTH",
            },
            quota_refund: true,
        });
        const clientMessageId = randomUUID();

        await answer(auth, { attachmentIds: [id], clientMessageId });
        const { payload } = await replyFor(clientMessageId);

        expect(gcs.keys()).toHaveLength(0);
        const record = await chatAttachmentModel.findById(id).lean();
        expect(record?.status).toBe(EAttachmentStatus.REJECTED);
        expect(record?.verdict?.code).toBe("UNRELATED");
        expect(await aiUsed(userId)).toBe(0);
        expect(payload.quota).toMatchObject({ used: 0 });
    });

    it("pays once for a retried POST of the same turn", async () => {
        const { userId, auth } = await createMother();
        mockSendUserQuery.mockResolvedValue({ answer: "Hello", intent: "USER_QUERY" });
        const clientMessageId = randomUUID();

        await answer(auth, { freeText: "is walking safe?", clientMessageId });
        await replyFor(clientMessageId);
        const retry = await answer(auth, { freeText: "is walking safe?", clientMessageId });

        expect(retry.status).toBe(200);
        expect(retry.body.data.duplicate).toBe(true);
        expect(mockSendUserQuery).toHaveBeenCalledTimes(1);
        expect(await aiUsed(userId)).toBe(1);
    });

    it("will not send the same file twice, or someone else's", async () => {
        const her = await createMother();
        const other = await createMother();
        const id = await uploaded(her.auth);
        mockSendUserQuery.mockResolvedValue(analyzed());
        const first = randomUUID();
        await answer(her.auth, { attachmentIds: [id], clientMessageId: first });
        await replyFor(first);

        const again = await answer(her.auth, {
            attachmentIds: [id],
            clientMessageId: randomUUID(),
        });
        expect(again.status).toBe(409);
        expect(again.body.data.code).toBe("ATTACHMENT_NOT_AVAILABLE");

        const theirs = await answer(other.auth, { attachmentIds: [await uploaded(her.auth)] });
        expect(theirs.status).toBe(409);
        expect(await aiUsed(other.userId)).toBe(0);
    });

    it("refuses a PDF sent together with photos, without spending", async () => {
        const { userId, auth } = await createMother();
        const photo = await uploaded(auth);
        const report = await uploaded(auth, await pdf(1), "r.pdf");

        const res = await answer(auth, { attachmentIds: [photo, report] });

        expect(res.status).toBe(400);
        expect(res.body.data.code).toBe("ATTACHMENT_MIXED_KINDS");
        expect(await aiUsed(userId)).toBe(0);
        // Both are free to send again.
        expect(
            await chatAttachmentModel.countDocuments({ status: EAttachmentStatus.UPLOADED }),
        ).toBe(2);
    });

    it("gives the files back when she is out of questions", async () => {
        const { userId, auth } = await createMother();
        const id = await uploaded(auth);
        await usageCounterModel.create({
            user_id: userId,
            key: EUsageCounterKey.AI_MESSAGE,
            windowKey: entitlementService.windowKeyFor(EQuotaWindow.DAY, undefined, new Date()),
            count: 3,
            expiresAt: new Date(Date.now() + 86_400_000),
        });

        const res = await answer(auth, { attachmentIds: [id], clientMessageId: randomUUID() });

        expect(res.status).toBe(402);
        expect((await chatAttachmentModel.findById(id).lean())?.status).toBe(
            EAttachmentStatus.UPLOADED,
        );
        expect(mockSendUserQuery).not.toHaveBeenCalled();
    });

    it("refunds once, drops the file and tells the app when the chatbot fails", async () => {
        const { userId, auth } = await createMother();
        const id = await uploaded(auth);
        mockSendUserQuery.mockRejectedValue(new Error("timeout of 60000ms exceeded"));
        const clientMessageId = randomUUID();

        await answer(auth, { attachmentIds: [id], clientMessageId });
        const { payload } = await replyFor(clientMessageId);

        expect(payload).toMatchObject({ type: "ai_error", code: "ATTACHMENT_PROCESSING_FAILED" });
        expect(await aiUsed(userId)).toBe(0);
        expect((await chatAttachmentModel.findById(id).lean())?.status).toBe(
            EAttachmentStatus.FAILED,
        );
        expect(gcs.keys()).toHaveLength(0);

        // The poll fallback resolves to the same outcome.
        const poll = await request(app)
            .get(`/api/v1/chat-flow/reply?clientMessageId=${clientMessageId}`)
            .set("Authorization", auth);
        expect(poll.status).toBe(200);
        expect(poll.body.data.reply).toMatchObject({ type: "ai_error", replyTo: clientMessageId });
    });

    it("does not charge a question for logging, or for typing 'yes' to the card", async () => {
        const { userId, auth } = await createMother();
        mockSendUserQuery.mockResolvedValue({
            answer: "Shall I save your BP 118/76?",
            intent: "LOG_PROPOSAL",
            proposed_logs: [{ logType: "bp", fields: { systolic: 118, diastolic: 76 } }],
        });
        const logTurn = randomUUID();
        await answer(auth, { freeText: "bp 118/76", clientMessageId: logTurn });
        const logged = await replyFor(logTurn);
        expect(logged.payload.quota).toMatchObject({ used: 0 });
        expect(await aiUsed(userId)).toBe(0);

        const yesTurn = randomUUID();
        // The app sends the conversation it is in; the card is looked up there.
        const conversationId = String(logged.payload.conversationId);
        await answer(auth, { freeText: "haan", clientMessageId: yesTurn, conversationId });
        const confirmed = await replyFor(yesTurn);

        expect(confirmed.payload.response).toMatchObject({ intent: "LOG_CONFIRMATION" });
        expect(confirmed.payload.quota).toMatchObject({ used: 0 });
        expect(mockSendUserQuery).toHaveBeenCalledTimes(1);
        expect(await aiUsed(userId)).toBe(0);
        expect(await motherLogModel.countDocuments({ userId, logType: "bp" })).toBe(1);

        // A real question is still paid for.
        mockSendUserQuery.mockResolvedValue({ answer: "Yes, gently.", intent: "USER_QUERY" });
        const question = randomUUID();
        await answer(auth, {
            freeText: "is walking safe?",
            clientMessageId: question,
            conversationId,
        });
        await replyFor(question);
        expect(await aiUsed(userId)).toBe(1);
    });

    it("does not take 'yes' with a file as an answer to a log card", async () => {
        const { auth } = await createMother();
        const id = await uploaded(auth);
        mockSendUserQuery.mockResolvedValue(analyzed());
        const clientMessageId = randomUUID();

        await answer(auth, { freeText: "yes", attachmentIds: [id], clientMessageId });
        await replyFor(clientMessageId);

        expect(mockSendUserQuery).toHaveBeenCalledTimes(1);
    });

    it("needs text or a file", async () => {
        const { auth } = await createMother();
        const res = await answer(auth, { freeText: "   " });
        expect(res.status).toBe(400);
    });

    it("serves the reply to a poll, 202 until it exists", async () => {
        const { auth } = await createMother();
        let release: (v: unknown) => void = () => undefined;
        mockSendUserQuery.mockReturnValue(
            new Promise((resolve) => {
                release = () => resolve({ answer: "Rest well.", intent: "USER_QUERY" });
            }),
        );
        const clientMessageId = randomUUID();
        await answer(auth, { freeText: "tips for sleep?", clientMessageId });

        await waitFor(async () => mockSendUserQuery.mock.calls.length > 0);
        const pending = await request(app)
            .get(`/api/v1/chat-flow/reply?clientMessageId=${clientMessageId}`)
            .set("Authorization", auth);
        expect(pending.status).toBe(202);

        release(null);
        await replyFor(clientMessageId);
        const ready = await request(app)
            .get(`/api/v1/chat-flow/reply?clientMessageId=${clientMessageId}`)
            .set("Authorization", auth);
        expect(ready.status).toBe(200);
        expect(ready.body.data.reply).toMatchObject({
            type: "ai_message",
            text: "Rest well.",
            replyTo: clientMessageId,
        });
        expect(ready.body.data.reply.sessionId).toBeTruthy();
    });
});

// ── Housekeeping ──────────────────────────────────────────────────────────────────

describe("chatAttachmentJanitor", () => {
    it("deletes files never sent within a day, and retries queued purges", async () => {
        const { userId, auth } = await createMother();
        const stale = await uploaded(auth);
        const fresh = await uploaded(auth);
        await chatAttachmentModel.collection.updateOne(
            { _id: new Types.ObjectId(stale) },
            { $set: { createdAt: new Date(Date.now() - 25 * 60 * 60 * 1000) } },
        );
        gcs.objects.set(`${env.CHAT_ATTACHMENTS_BUCKET}/chat/deleted-user/x.jpg`, {
            data: Buffer.from("x"),
        });
        await pendingGcsPurgeModel.create({
            bucket: env.CHAT_ATTACHMENTS_BUCKET,
            prefix: "chat/deleted-user/",
        });

        const result = await chatAttachmentJanitor();

        expect(result).toMatchObject({ orphans: 1, purgedPrefixes: 1 });
        expect((await chatAttachmentModel.findById(stale).lean())?.status).toBe(
            EAttachmentStatus.DELETED,
        );
        expect((await chatAttachmentModel.findById(fresh).lean())?.status).toBe(
            EAttachmentStatus.UPLOADED,
        );
        expect(gcs.keys().filter((k) => k.includes(`chat/${userId}/`))).toHaveLength(1);
        expect(gcs.keys().some((k) => k.includes("deleted-user"))).toBe(false);
        expect(await pendingGcsPurgeModel.countDocuments({})).toBe(0);
    });
});

describe("message attachments", () => {
    it("persist as objects, not strings", async () => {
        const doc = await messageModel.create({
            userId: "u1",
            role: MessageRoleEnum.USER,
            type: "AI",
            text: "",
            attachments: [
                {
                    attachmentId: new Types.ObjectId(),
                    kind: "PDF",
                    mimeType: "application/pdf",
                    pageCount: 2,
                    originalName: "cbc.pdf",
                },
            ],
        });
        const back = await messageModel.findById(doc._id).lean();
        expect(back?.attachments?.[0]).toMatchObject({
            kind: "PDF",
            pageCount: 2,
            originalName: "cbc.pdf",
        });
    });
});
