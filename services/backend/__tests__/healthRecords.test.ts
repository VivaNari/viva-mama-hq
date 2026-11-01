/**
 * Health records: her saved scans, lab reports, prescriptions and MCH card, and the
 * overall health summary built from them.
 *
 * What has to hold: a page is checked and cleaned before it is stored; a record is
 * 1 PDF or up to 5 photos; only she can read, change or delete it; a refused or failed
 * record costs her nothing; deleting erases the files and the summary for good; and
 * the overall summary is built from what is stored, marked out of date when records
 * change.
 *
 * Real sharp and pdf-lib on generated fixtures, in-memory Mongo, fake storage.
 *
 * Run:  npx jest healthRecords
 */

jest.mock(require.resolve("../src/config/firebase"), () => ({ __esModule: true, default: null }));
jest.mock(require.resolve("../src/config/redis.config"), () => ({ __esModule: true }));
jest.mock("razorpay", () =>
    jest.fn().mockImplementation(() => ({ orders: { create: jest.fn() } })),
);
const mockAnalyzeRecord = jest.fn();
const mockBuildHealthSummary = jest.fn();
jest.mock("../src/services/llm/llm.service", () => ({
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
        sendUserQuery: jest.fn(),
        sendNameQuery: jest.fn(),
        analyzeRecord: mockAnalyzeRecord,
        buildHealthSummary: mockBuildHealthSummary,
    })),
}));

import { randomUUID } from "crypto";

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
import { healthRecordsJanitor } from "../src/cron-jobs/healthRecordsJanitor";
import healthRecordModel from "../src/models/health-record.model";
import healthSummaryModel from "../src/models/health-summary.model";
import motherLogModel from "../src/models/mother-log.model";
import motherMedicineModel from "../src/models/mother-medicine.model";
import pendingGcsPurgeModel from "../src/models/pending-gcs-purge.model";
import usageCounterModel from "../src/models/usage-counter.model";
import UserModel from "../src/models/user.model";
import { EQuotaWindow } from "../src/services/entitlements/entitlement.config";
import { entitlementService, istDayKey } from "../src/services/entitlements/entitlement.service";
import { EHealthRecordStatus, EHealthSummaryStatus } from "../src/types/health-record.types";
import { EUsageCounterKey } from "../src/types/subscription.types";
import { EChildOnboardingStatus, EUserCategory } from "../src/types/user.types";

jest.setTimeout(120000);

const gcs = createFakeGcs();
setStorageForTests(gcs.storage);
const BUCKET = env.HEALTH_RECORDS_BUCKET;

beforeAll(connectTestDb);
afterAll(closeTestDb);
beforeEach(() => {
    mockAnalyzeRecord.mockReset();
    mockBuildHealthSummary.mockReset();
    gcs.objects.clear();
});
afterEach(clearTestDb);

// ── Fixtures ──────────────────────────────────────────────────────────────────────

const jpeg = () =>
    sharp({ create: { width: 1200, height: 900, channels: 3, background: "#f5f5f5" } })
        .jpeg()
        .toBuffer();
const pdf = async (pages = 1) => {
    const doc = await PDFDocument.create();
    for (let i = 0; i < pages; i++) doc.addPage([595, 842]).drawText("Haemoglobin 11.2 g/dL");
    return Buffer.from(await doc.save());
};

const analyzed = (extra: Record<string, unknown> = {}) => ({
    request_id: "r1",
    verdict: "ANALYZED",
    reason_code: "OK",
    document_type: "lab_report",
    title: "Complete Blood Count",
    report_date: "2026-06-12",
    summary_markdown: "**What this is**\nA blood test report.",
    digest: "Document: Complete Blood Count\n- Haemoglobin: 9.8 g/dL; status low",
    analysis: {
        findings: [
            { name: "Haemoglobin", value: "9.8", unit: "g/dL", status: "low" },
            { name: "Platelets", value: "2.1", unit: "lakh", status: "normal" },
        ],
    },
    severity: "MEDIUM",
    critical_matches: ["Haemoglobin 9.8 g/dL"],
    ...extra,
});

const refused = {
    request_id: "r1",
    verdict: "UNRELATED",
    reason_code: "NOT_HEALTH",
    message: "This doesn't look like a health record for you or your baby, so it wasn't saved.",
    severity: "NONE",
    critical_matches: [],
};

// ── Helpers ───────────────────────────────────────────────────────────────────────

async function createMother({ consent = true, childs = [] as any[] } = {}) {
    const user = await UserModel.create({
        mobile_number: `9${Math.floor(100000000 + Math.random() * 899999999)}`,
        user_category: EUserCategory.NP,
        onboarding_data: { preferred_name: "Asha", height_cm: 160 },
        childs,
        ...(consent
            ? {
                  health_records_consent: {
                      version: env.HEALTH_RECORDS_CONSENT_VERSION,
                      acceptedAt: new Date(),
                  },
              }
            : {}),
    });
    const userId = user._id.toString();
    return { userId, user, auth: `Bearer ${jwt.sign({ _id: userId }, env.JWT_SECRET as string)}` };
}

const api = (auth: string) => ({
    get: (path: string) => request(app).get(`/api/v1${path}`).set("Authorization", auth),
    post: (path: string, body: object = {}) =>
        request(app).post(`/api/v1${path}`).set("Authorization", auth).send(body),
    patch: (path: string, body: object) =>
        request(app).patch(`/api/v1${path}`).set("Authorization", auth).send(body),
    del: (path: string) => request(app).delete(`/api/v1${path}`).set("Authorization", auth),
    page: (recordId: string, file: Buffer, name = "page.jpg", clientUploadId = randomUUID()) =>
        request(app)
            .post(`/api/v1/health-records/${recordId}/files`)
            .set("Authorization", auth)
            .field("clientUploadId", clientUploadId)
            .attach("file", file, name),
});

async function draft(auth: string, body: Record<string, unknown> = {}) {
    const res = await api(auth).post("/health-records", {
        clientUploadId: randomUUID(),
        category: "lab",
        subject: { type: "MOTHER" },
        ...body,
    });
    expect(res.status).toBe(201);
    return res.body.data.record.id as string;
}

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

/**
 * The record once its reading has finished. A refused or failed record is marked
 * first and refunded (and, if refused, its files deleted) just after, so this also
 * waits for the refund claim; the counter itself is checked with `usedBecomes`.
 */
const settled = (id: string) =>
    waitFor(async () => {
        const r = await healthRecordModel.findById(id).lean();
        if (!r || r.status === EHealthRecordStatus.PROCESSING) return null;
        const refundable =
            r.status === EHealthRecordStatus.FAILED || r.status === EHealthRecordStatus.REJECTED;
        return refundable && !r.quotaRefunded ? null : r;
    });

const used = async (userId: string, key: EUsageCounterKey) =>
    (await usageCounterModel.findOne({ user_id: userId, key }).lean())?.count ?? 0;

/** Wait for a refund to land: the counter moves just after the status does. */
const usedBecomes = (userId: string, key: EUsageCounterKey, expected: number) =>
    waitFor(async () => (await used(userId, key)) === expected);

/** A READY record straight in the database, for list and summary tests. */
const readyRecord = (userId: string, date: string, extra: Record<string, unknown> = {}) =>
    healthRecordModel.create({
        userId,
        clientUploadId: randomUUID(),
        category: "lab",
        subject: { type: "MOTHER", childId: null },
        bucket: BUCKET,
        status: EHealthRecordStatus.READY,
        title: `CBC ${date}`,
        recordDate: new Date(`${date}T00:00:00.000Z`),
        files: [],
        summary: {
            markdown: "x",
            analysis: analyzed().analysis,
            digest: `Document: CBC ${date}`,
            severity: "NONE",
            criticalMatches: [],
            lang: "en",
            generatedAt: new Date(),
        },
        ...extra,
    });

// ── Config and consent ────────────────────────────────────────────────────────────

describe("config and consent", () => {
    it("reports limits, consent and both quotas", async () => {
        const { auth } = await createMother({ consent: false });
        const res = await api(auth).get("/health-records/config");
        expect(res.status).toBe(200);
        expect(res.body.data).toMatchObject({
            enabled: true,
            maxFiles: 5,
            consentAccepted: false,
            quota: { uploads: { limit: 5 }, summaries: { limit: 1 } },
        });
    });

    it("needs consent before a record is started, without ending her session", async () => {
        const { auth } = await createMother({ consent: false });
        const res = await api(auth).post("/health-records", {
            clientUploadId: randomUUID(),
            category: "lab",
            subject: { type: "MOTHER" },
        });
        expect(res.status).toBe(403);
        expect(res.body.data.code).toBe("HEALTH_RECORDS_CONSENT_REQUIRED");

        const stale = await api(auth).post("/health-records/consent", { consentVersion: "old" });
        expect(stale.status).toBe(409);
        const ok = await api(auth).post("/health-records/consent", {
            consentVersion: env.HEALTH_RECORDS_CONSENT_VERSION,
        });
        expect(ok.status).toBe(200);
        await draft(auth);
    });
});

// ── Adding a record ───────────────────────────────────────────────────────────────

describe("adding a record", () => {
    it("stores the pages, reads them once and keeps the summary", async () => {
        const { userId, auth } = await createMother();
        const id = await draft(auth);
        const pageId = randomUUID();
        expect((await api(auth).page(id, await jpeg(), "p1.jpg", pageId)).status).toBe(201);
        // A retried page upload stores nothing new.
        expect((await api(auth).page(id, await jpeg(), "p1.jpg", pageId)).status).toBe(200);
        expect((await api(auth).page(id, await jpeg())).status).toBe(201);
        expect(gcs.keys()).toHaveLength(2);

        mockAnalyzeRecord.mockResolvedValue(analyzed());
        const res = await api(auth).post(`/health-records/${id}/submit`, { lang: "hi-IN" });
        expect(res.status).toBe(202);
        // A double tap does not spend twice.
        await api(auth).post(`/health-records/${id}/submit`, { lang: "hi" });

        const record = await settled(id);
        expect(record.status).toBe(EHealthRecordStatus.READY);
        expect(record.title).toBe("Complete Blood Count");
        // Filed on the day she added it, not the 2026-06-12 printed on the report.
        expect(record.recordDate.toISOString().slice(0, 10)).toBe(istDayKey());
        expect(record.summary?.severity).toBe("MEDIUM");
        expect(await used(userId, EUsageCounterKey.RECORD_UPLOAD)).toBe(1);

        expect(mockAnalyzeRecord).toHaveBeenCalledTimes(1);
        const payload = mockAnalyzeRecord.mock.calls[0][0];
        expect(payload).toMatchObject({
            user_id: userId,
            record_id: id,
            category: "lab",
            subject: { type: "mother" },
            lang: "hi",
        });
        expect(payload.files).toHaveLength(2);
        for (const f of payload.files) {
            expect(f.uri.startsWith(`gs://${BUCKET}/records/${userId}/${id}/`)).toBe(true);
        }

        const view = await api(auth).get(`/health-records/${id}`);
        expect(view.body.data.record.summary.markdown).toContain("What this is");
        expect(view.body.data.record.files).toHaveLength(2);
    });

    it("takes 1 PDF or up to 5 photos, never both", async () => {
        const { auth } = await createMother();
        const photos = await draft(auth);
        for (let i = 0; i < 5; i++) {
            expect((await api(auth).page(photos, await jpeg())).status).toBe(201);
        }
        const sixth = await api(auth).page(photos, await jpeg());
        expect(sixth.status).toBe(400);
        expect(sixth.body.data.code).toBe("HEALTH_RECORD_TOO_MANY_FILES");

        const mixed = await draft(auth);
        await api(auth).page(mixed, await jpeg());
        const pdfAfterPhoto = await api(auth).page(mixed, await pdf(), "r.pdf");
        expect(pdfAfterPhoto.body.data.code).toBe("HEALTH_RECORD_MIXED_KINDS");

        const onePdf = await draft(auth);
        expect((await api(auth).page(onePdf, await pdf(12), "report.pdf")).status).toBe(201);
        const photoAfterPdf = await api(auth).page(onePdf, await jpeg());
        expect(photoAfterPdf.body.data.code).toBe("HEALTH_RECORD_MIXED_KINDS");
    });

    it("files a record under one of her babies only", async () => {
        const childId = new Types.ObjectId();
        const draftChildId = new Types.ObjectId();
        const { auth } = await createMother({
            childs: [
                {
                    _id: childId,
                    name: "Meera",
                    sex: "Female",
                    date_of_birth: new Date(Date.now() - 45 * 24 * 3600 * 1000),
                    onboarding_status: EChildOnboardingStatus.COMPLETED,
                },
                { _id: draftChildId, onboarding_status: EChildOnboardingStatus.DRAFT },
            ],
        });
        const other = await createMother();
        const someoneElsesChild = new Types.ObjectId();
        await UserModel.updateOne(
            { _id: other.userId },
            { $push: { childs: { _id: someoneElsesChild, name: "X" } } },
        );

        for (const bad of [someoneElsesChild, draftChildId]) {
            const res = await api(auth).post("/health-records", {
                clientUploadId: randomUUID(),
                category: "mch",
                subject: { type: "CHILD", childId: String(bad) },
            });
            expect(res.status).toBe(422);
        }

        const id = await draft(auth, {
            category: "mch",
            subject: { type: "CHILD", childId: String(childId) },
        });
        await api(auth).page(id, await jpeg());
        mockAnalyzeRecord.mockResolvedValue(analyzed());
        await api(auth).post(`/health-records/${id}/submit`, {});
        await settled(id);
        expect(mockAnalyzeRecord.mock.calls[0][0].subject).toEqual({
            type: "child",
            child_name: "Meera",
            child_age_text: "6 weeks old",
        });
    });

    it("deletes a refused record's files at once and gives the upload back", async () => {
        const { userId, auth } = await createMother();
        const id = await draft(auth);
        await api(auth).page(id, await jpeg());
        mockAnalyzeRecord.mockResolvedValue(refused);
        await api(auth).post(`/health-records/${id}/submit`, {});

        const record = await settled(id);
        expect(record.status).toBe(EHealthRecordStatus.REJECTED);
        expect(record.message).toContain("wasn't saved");
        expect(record.files).toHaveLength(0);
        expect(record.purgeAt).toBeTruthy();
        expect(gcs.keys()).toHaveLength(0);
        await usedBecomes(userId, EUsageCounterKey.RECORD_UPLOAD, 0);
    });

    it("keeps a failed record's files, refunds it, and lets her retry", async () => {
        const { userId, auth } = await createMother();
        const id = await draft(auth);
        await api(auth).page(id, await jpeg());
        mockAnalyzeRecord.mockRejectedValueOnce(new Error("timeout of 150000ms exceeded"));
        await api(auth).post(`/health-records/${id}/submit`, {});

        const failed = await settled(id);
        expect(failed.status).toBe(EHealthRecordStatus.FAILED);
        expect(failed.verdict?.reasonCode).toBe("CHATBOT_UNAVAILABLE");
        expect(gcs.keys()).toHaveLength(1);
        await usedBecomes(userId, EUsageCounterKey.RECORD_UPLOAD, 0);

        mockAnalyzeRecord.mockResolvedValue(analyzed());
        expect((await api(auth).post(`/health-records/${id}/retry`)).status).toBe(202);
        expect((await settled(id)).status).toBe(EHealthRecordStatus.READY);
        expect(await used(userId, EUsageCounterKey.RECORD_UPLOAD)).toBe(1);
    });

    it("stops a free user at 5 records a month and keeps her draft", async () => {
        const { userId, auth } = await createMother();
        await usageCounterModel.create({
            user_id: userId,
            key: EUsageCounterKey.RECORD_UPLOAD,
            windowKey: entitlementService.windowKeyFor(EQuotaWindow.MONTH, undefined),
            count: 5,
            expiresAt: new Date(Date.now() + 86400000),
        });
        const id = await draft(auth);
        await api(auth).page(id, await jpeg());
        const res = await api(auth).post(`/health-records/${id}/submit`, {});
        expect(res.status).toBe(402);
        expect(res.body.data.code).toBe("QUOTA_EXCEEDED");
        expect((await healthRecordModel.findById(id))?.status).toBe(EHealthRecordStatus.DRAFT);
        expect(mockAnalyzeRecord).not.toHaveBeenCalled();
    });
});

// ── Reading and editing ───────────────────────────────────────────────────────────

describe("her records", () => {
    it("are listed newest report first, grouped by day, page by page", async () => {
        const { userId, auth } = await createMother();
        await readyRecord(userId, "2026-09-03");
        await readyRecord(userId, "2026-09-03");
        await readyRecord(userId, "2026-06-12");
        await draft(auth); // drafts are not listed

        // The app adds ?lang= to every request.
        const first = await api(auth).get("/health-records?limit=2&lang=hi-IN");
        expect(first.status).toBe(200);
        expect(first.body.data.groups).toEqual([
            expect.objectContaining({ date: "2026-09-03", records: expect.any(Array) }),
        ]);
        expect(first.body.data.groups[0].records).toHaveLength(2);
        expect(first.body.data.readyRecords).toBe(3);

        const next = await api(auth).get(
            `/health-records?limit=2&cursor=${first.body.data.nextCursor}`,
        );
        expect(next.body.data.groups.map((g: any) => g.date)).toEqual(["2026-06-12"]);
        expect(next.body.data.nextCursor).toBeNull();
    });

    it("are hers alone: another user gets 404 for every route", async () => {
        const { userId } = await createMother();
        const record = await readyRecord(userId, "2026-09-03");
        const other = await createMother();
        const id = String(record._id);
        expect((await api(other.auth).get(`/health-records/${id}`)).status).toBe(404);
        expect(
            (await api(other.auth).patch(`/health-records/${id}`, { category: "scan" })).status,
        ).toBe(404);
        expect((await api(other.auth).del(`/health-records/${id}`)).status).toBe(404);
        expect((await api(other.auth).get(`/health-records/${id}/files/x/url`)).status).toBe(404);
        const bulk = await api(other.auth).post("/health-records/delete", { ids: [id] });
        expect(bulk.body.data.deleted).toBe(0);
        expect(await healthRecordModel.exists({ _id: id })).toBeTruthy();
    });

    it("are filed on the day she adds them, whatever date is printed on them", async () => {
        const { auth } = await createMother();
        const id = await draft(auth, { category: "mch" });
        await api(auth).page(id, await jpeg());
        // An MCH card carries many visit dates; the reader picks one of them.
        mockAnalyzeRecord.mockResolvedValue(analyzed({ report_date: "2025-10-25" }));
        await api(auth).post(`/health-records/${id}/submit`, {});
        const record = await settled(id);
        expect(record.recordDate.toISOString().slice(0, 10)).toBe(istDayKey());

        // And she cannot move it to another day.
        const res = await api(auth).patch(`/health-records/${id}`, { recordDate: "2026-08-01" });
        expect(res.status).toBe(400);
    });
});

// ── Deleting ──────────────────────────────────────────────────────────────────────

describe("deleting records", () => {
    it("erases the files and the record with its summary, and refunds nothing", async () => {
        const { userId, auth } = await createMother();
        const id = await draft(auth);
        await api(auth).page(id, await jpeg());
        await api(auth).page(id, await jpeg());
        mockAnalyzeRecord.mockResolvedValue(analyzed());
        await api(auth).post(`/health-records/${id}/submit`, {});
        await settled(id);
        expect(gcs.keys()).toHaveLength(2);

        const res = await api(auth).del(`/health-records/${id}`);
        expect(res.status).toBe(200);
        expect(gcs.keys()).toHaveLength(0);
        expect(await healthRecordModel.exists({ _id: id })).toBeNull();
        expect(await used(userId, EUsageCounterKey.RECORD_UPLOAD)).toBe(1);
    });

    it("still deletes when storage is down, and queues the files", async () => {
        const { userId, auth } = await createMother();
        const id = await draft(auth);
        await api(auth).page(id, await jpeg());
        gcs.failNext("deleteFiles");

        const res = await api(auth).del(`/health-records/${id}`);
        expect(res.status).toBe(200);
        expect(await healthRecordModel.exists({ _id: id })).toBeNull();
        const purge = await pendingGcsPurgeModel.findOne().lean();
        expect(purge).toMatchObject({ bucket: BUCKET, prefix: `records/${userId}/${id}/` });
    });

    it("drops the reading of a record deleted while it was being read", async () => {
        const { auth } = await createMother();
        const id = await draft(auth);
        await api(auth).page(id, await jpeg());
        let finish: (v: unknown) => void = () => undefined;
        mockAnalyzeRecord.mockReturnValue(new Promise((r) => (finish = r)));
        await api(auth).post(`/health-records/${id}/submit`, {});
        await waitFor(async () => mockAnalyzeRecord.mock.calls.length > 0);

        expect((await api(auth).del(`/health-records/${id}`)).status).toBe(200);
        finish(analyzed());
        await new Promise((r) => setTimeout(r, 100));
        expect(await healthRecordModel.exists({ _id: id })).toBeNull();
    });

    it("deletes several of hers at once and leaves anyone else's", async () => {
        const { userId, auth } = await createMother();
        const other = await createMother();
        const mine = [
            await readyRecord(userId, "2026-09-01"),
            await readyRecord(userId, "2026-09-02"),
        ];
        const theirs = await readyRecord(other.userId, "2026-09-03");
        const res = await api(auth).post("/health-records/delete", {
            ids: [...mine.map((r) => String(r._id)), String(theirs._id)],
        });
        expect(res.body.data.deleted).toBe(2);
        expect(await healthRecordModel.countDocuments({ userId })).toBe(0);
        expect(await healthRecordModel.exists({ _id: theirs._id })).toBeTruthy();
    });
});

// ── Overall summary ───────────────────────────────────────────────────────────────

const summaryResult = {
    request_id: "s1",
    content: { overview: "My records show a low haemoglobin in June." },
    share_text: "VivaMama health summary — Asha",
};

const summaryReady = (id: string) =>
    waitFor(async () => {
        const s = await healthSummaryModel.findById(id).lean();
        return s && s.status !== EHealthSummaryStatus.PENDING ? s : null;
    });

describe("overall health summary", () => {
    it("needs at least one saved record", async () => {
        const { auth } = await createMother();
        const res = await api(auth).post("/health-records/summary", {});
        expect(res.status).toBe(422);
        expect(res.body.data.code).toBe("HEALTH_SUMMARY_NO_RECORDS");
    });

    it("is built from her records, recent readings, medicines and finished babies", async () => {
        const childId = new Types.ObjectId();
        const { userId, auth } = await createMother({
            childs: [
                {
                    _id: childId,
                    name: "Meera",
                    onboarding_status: EChildOnboardingStatus.COMPLETED,
                },
                { name: "Half-added", onboarding_status: EChildOnboardingStatus.DRAFT },
            ],
        });
        await readyRecord(userId, "2026-06-12", {
            summary: {
                markdown: "x",
                analysis: analyzed().analysis,
                digest: "Document: CBC",
                severity: "MEDIUM",
                criticalMatches: ["Haemoglobin 9.8 g/dL"],
                lang: "en",
                generatedAt: new Date(),
            },
        });
        await readyRecord(userId, "2026-09-03", {
            category: "mch",
            subject: { type: "CHILD", childId },
        });
        const today = new Date(new Date().toISOString().slice(0, 10) + "T00:00:00.000Z");
        await motherLogModel.create({
            userId,
            logType: "bp",
            logDate: today,
            loggedAt: new Date(),
            fields: { systolic: 118, diastolic: 76 },
        });
        await motherLogModel.create({
            userId,
            logType: "weight",
            logDate: today,
            loggedAt: new Date(),
            fields: { weightKg: 64 },
        });
        await motherMedicineModel.create({
            userId,
            presetKey: "iron_folic_acid",
            frequency: "once_a_day",
        });
        mockBuildHealthSummary.mockResolvedValue(summaryResult);

        const res = await api(auth).post("/health-records/summary", { lang: "en" });
        expect(res.status).toBe(202);
        const summary = await summaryReady(res.body.data.summary.id);
        expect(summary.status).toBe(EHealthSummaryStatus.READY);
        expect(summary.shareText).toBe(summaryResult.share_text);
        expect(await used(userId, EUsageCounterKey.HEALTH_SUMMARY)).toBe(1);

        const payload = mockBuildHealthSummary.mock.calls[0][0];
        expect(payload.child_names).toEqual(["Meera"]);
        expect(payload.records.map((r: any) => r.record_date)).toEqual([
            "2026-09-03",
            "2026-06-12",
        ]);
        expect(payload.records[0].subject).toEqual({ type: "child", child_name: "Meera" });
        expect(payload.records[1].out_of_range).toEqual([
            {
                name: "Haemoglobin",
                value: "9.8",
                unit: "g/dL",
                reference_range: null,
                status: "low",
            },
        ]);
        expect(payload.vitals).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ type: "bp", value: "118/76", unit: "mmHg" }),
                expect.objectContaining({ type: "weight", value: "64", note: "BMI 25" }),
            ]),
        );
        expect(payload.medicines).toEqual([{ name: "Iron + folic acid", frequency: "once a day" }]);
    });

    it("is shown as out of date when a record is added or deleted", async () => {
        const { userId, auth } = await createMother();
        const first = await readyRecord(userId, "2026-06-12");
        mockBuildHealthSummary.mockResolvedValue(summaryResult);
        const res = await api(auth).post("/health-records/summary", {});
        await summaryReady(res.body.data.summary.id);

        let latest = await api(auth).get("/health-records/summary/latest");
        expect(latest.body.data.summary.shareText).toBe(summaryResult.share_text);
        expect(latest.body.data.stale).toBeNull();

        await readyRecord(userId, "2026-09-03");
        latest = await api(auth).get("/health-records/summary/latest");
        expect(latest.body.data.stale).toEqual({ newRecords: 1, removedRecords: 0 });

        await api(auth).del(`/health-records/${first._id}`);
        latest = await api(auth).get("/health-records/summary/latest");
        expect(latest.body.data.stale).toEqual({ newRecords: 1, removedRecords: 1 });
    });

    it("refunds a failed summary, and a free user gets one a week", async () => {
        const { userId, auth } = await createMother();
        await readyRecord(userId, "2026-06-12");
        mockBuildHealthSummary.mockRejectedValueOnce(new Error("502"));
        const failed = await api(auth).post("/health-records/summary", {});
        expect((await summaryReady(failed.body.data.summary.id)).status).toBe(
            EHealthSummaryStatus.FAILED,
        );
        await usedBecomes(userId, EUsageCounterKey.HEALTH_SUMMARY, 0);

        mockBuildHealthSummary.mockResolvedValue(summaryResult);
        const ok = await api(auth).post("/health-records/summary", {});
        await summaryReady(ok.body.data.summary.id);
        const second = await api(auth).post("/health-records/summary", {});
        expect(second.status).toBe(402);
    });

    it("can be deleted, by her only", async () => {
        const { userId, auth } = await createMother();
        await readyRecord(userId, "2026-06-12");
        mockBuildHealthSummary.mockResolvedValue(summaryResult);
        const res = await api(auth).post("/health-records/summary", {});
        const id = res.body.data.summary.id;
        await summaryReady(id);

        const other = await createMother();
        expect((await api(other.auth).del(`/health-records/summary/${id}`)).status).toBe(404);
        expect(
            (await api(auth).get("/health-records/summary/history")).body.data.summaries,
        ).toHaveLength(1);
        expect((await api(auth).del(`/health-records/summary/${id}`)).status).toBe(200);
        expect(await healthSummaryModel.exists({ _id: id })).toBeNull();
        const latest = await api(auth).get("/health-records/summary/latest");
        expect(latest.body.data.summary).toBeNull();
    });
});

// ── Janitor and quota windows ─────────────────────────────────────────────────────

describe("health records janitor", () => {
    it("deletes stale drafts and fails stuck reads with a refund", async () => {
        const { userId, auth } = await createMother();
        const stale = await draft(auth);
        await api(auth).page(stale, await jpeg());
        const stuck = await draft(auth);
        await api(auth).page(stuck, await jpeg());
        mockAnalyzeRecord.mockReturnValue(new Promise(() => undefined));
        await api(auth).post(`/health-records/${stuck}/submit`, {});
        expect(await used(userId, EUsageCounterKey.RECORD_UPLOAD)).toBe(1);

        const later = new Date(Date.now() + 25 * 60 * 60 * 1000);
        await healthRecordModel.collection.updateOne(
            { _id: new Types.ObjectId(stale) },
            { $set: { updatedAt: new Date(Date.now() - 25 * 60 * 60 * 1000) } },
        );
        const result = await healthRecordsJanitor(later);

        expect(result).toMatchObject({ drafts: 1, stuckRecords: 1 });
        expect(await healthRecordModel.exists({ _id: stale })).toBeNull();
        expect((await healthRecordModel.findById(stuck))?.status).toBe(EHealthRecordStatus.FAILED);
        expect(await used(userId, EUsageCounterKey.RECORD_UPLOAD)).toBe(0);
        expect(gcs.keys().every((k) => !k.includes(stale))).toBe(true);
    });
});

describe("week and month quota windows", () => {
    it("key on the IST Monday and the IST month", () => {
        // Sunday 2026-11-01 20:00 UTC is Monday 01:30 IST.
        const mondayIst = new Date("2026-11-01T20:00:00.000Z");
        expect(entitlementService.windowKeyFor(EQuotaWindow.WEEK, undefined, mondayIst)).toBe(
            "w:2026-11-02",
        );
        const sundayIst = new Date("2026-11-01T10:00:00.000Z");
        expect(entitlementService.windowKeyFor(EQuotaWindow.WEEK, undefined, sundayIst)).toBe(
            "w:2026-10-26",
        );
        expect(entitlementService.windowKeyFor(EQuotaWindow.MONTH, undefined, sundayIst)).toBe(
            "m:2026-11",
        );
        expect(entitlementService.resetAtFor(EQuotaWindow.MONTH, undefined, sundayIst)).toEqual(
            new Date("2026-11-30T18:30:00.000Z"),
        );
    });
});
