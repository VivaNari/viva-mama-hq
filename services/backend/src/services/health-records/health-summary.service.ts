import { Types } from "mongoose";

import healthRecordModel from "../../models/health-record.model";
import healthSummaryModel from "../../models/health-summary.model";
import motherLogModel from "../../models/mother-log.model";
import motherMedicineModel from "../../models/mother-medicine.model";
import UserModel from "../../models/user.model";
import {
    EHealthRecordError,
    EHealthRecordStatus,
    EHealthSummaryStatus,
    ERecordSubject,
    HealthRecordError,
    IHealthRecord,
    IHealthSummary,
} from "../../types/health-record.types";
import { IMotherMedicine } from "../../types/mother-log.types";
import { EChildOnboardingStatus, IChild } from "../../types/user.types";
import logger, { createModuleLogger } from "../../utils/logger";
import { getISTCalendarDate } from "../date/date.service";
import { ECapability } from "../entitlements/entitlement.config";
import { entitlementService } from "../entitlements/entitlement.service";
import LLMService, { THealthSummaryPayload } from "../llm/llm.service";
import { bmiFor } from "../mother-log/mother-log.service";
import { recordDayKey } from "./health-record.service";

const log = createModuleLogger(logger, "health-summary");

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MAX_RECORDS = 30;
const VITALS_DAYS = 30;
const VITALS_PER_TYPE = 2;
/** A summary still PENDING after this is treated as lost (the janitor fails it). */
export const SUMMARY_PENDING_TIMEOUT_MS = 10 * 60 * 1000;
const OUT_OF_RANGE = new Set(["low", "high", "borderline", "critical"]);

const MEDICINE_NAMES: Record<"en" | "hi", Record<string, string>> = {
    en: {
        iron_folic_acid: "Iron + folic acid",
        calcium: "Calcium",
        vitamin_d: "Vitamin D",
        insulin: "Insulin",
    },
    hi: {
        iron_folic_acid: "आयरन + फ़ोलिक एसिड",
        calcium: "कैल्शियम",
        vitamin_d: "विटामिन D",
        insulin: "इंसुलिन",
    },
};
const FREQUENCIES: Record<"en" | "hi", Record<string, string>> = {
    en: {
        once_a_day: "once a day",
        twice_a_day: "twice a day",
        thrice_a_day: "three times a day",
        sos: "when needed",
    },
    hi: {
        once_a_day: "दिन में एक बार",
        twice_a_day: "दिन में दो बार",
        thrice_a_day: "दिन में तीन बार",
        sos: "ज़रूरत पड़ने पर",
    },
};
const SUGAR_TIMING: Record<"en" | "hi", Record<string, string>> = {
    en: { fasting: "fasting", post_meal: "after a meal" },
    hi: { fasting: "खाली पेट", post_meal: "खाने के बाद" },
};

export type TSummaryView = {
    id: string;
    status: EHealthSummaryStatus;
    lang: string;
    content: Record<string, unknown> | null;
    shareText: string | null;
    errorCode: string | null;
    recordCount: number;
    createdAt: Date;
};

const clip = (s: unknown, n: number): string => String(s ?? "").slice(0, n);

const toView = (s: IHealthSummary): TSummaryView => ({
    id: String(s._id),
    status: s.status,
    lang: s.lang,
    content: s.content,
    shareText: s.shareText,
    errorCode: s.errorCode,
    recordCount: s.sourceRecordIds.length,
    createdAt: s.createdAt,
});

class HealthSummaryService {
    private llm = new LLMService();

    private liveReady(userId: string) {
        return { userId, deletedAt: null, status: EHealthRecordStatus.READY };
    }

    /**
     * Start a new summary of her READY records. If one is already being built, that
     * one is returned instead of spending again.
     */
    async generate(
        userId: string,
        lang: "en" | "hi",
    ): Promise<{
        summary: TSummaryView;
        quota: Awaited<ReturnType<typeof entitlementService.peekQuota>>;
    }> {
        const pending = await healthSummaryModel.findOne({
            userId,
            status: EHealthSummaryStatus.PENDING,
            createdAt: { $gt: new Date(Date.now() - SUMMARY_PENDING_TIMEOUT_MS) },
        });
        if (pending) {
            return {
                summary: toView(pending),
                quota: await entitlementService.peekQuota(userId, ECapability.HEALTH_SUMMARY),
            };
        }

        const records = await healthRecordModel
            .find(this.liveReady(userId))
            .sort({ recordDate: -1, _id: -1 })
            .limit(MAX_RECORDS);
        if (records.length === 0) {
            throw new HealthRecordError(EHealthRecordError.NO_RECORDS, 422);
        }

        const quota = await entitlementService.consumeCapability(
            userId,
            ECapability.HEALTH_SUMMARY,
        );
        const summary = await healthSummaryModel.create({
            userId,
            status: EHealthSummaryStatus.PENDING,
            lang,
            sourceRecordIds: records.map((r) => r._id),
        });
        this.build(summary, records).catch(async (err) => {
            log.error(
                { err: { message: (err as Error)?.message }, summaryId: String(summary._id) },
                "Health summary failed",
            );
            await this.markFailed(summary, "SUMMARY_FAILED").catch(() => undefined);
        });
        return { summary: toView(summary), quota };
    }

    /** What the chatbot is given: per-record digests, recent vitals, current medicines. */
    async buildPayload(
        userId: string,
        lang: "en" | "hi",
        records: IHealthRecord[],
        now: Date = new Date(),
    ): Promise<THealthSummaryPayload> {
        const since = new Date(getISTCalendarDate(now).getTime() - VITALS_DAYS * MS_PER_DAY);
        const [user, logs, medicines] = await Promise.all([
            UserModel.findById(userId).select("childs onboarding_data.height_cm").lean(),
            motherLogModel
                .find({
                    userId,
                    logType: { $in: ["bp", "sugar", "hb", "weight"] },
                    logDate: { $gte: since },
                })
                .sort({ logDate: -1, loggedAt: -1 })
                .limit(200)
                .lean(),
            motherMedicineModel
                .find({ userId, active: true })
                .sort({ createdAt: 1 })
                .limit(20)
                .lean() as unknown as Promise<IMotherMedicine[]>,
        ]);
        const children = ((user?.childs ?? []) as IChild[]).filter(
            (c) => c.onboarding_status !== EChildOnboardingStatus.DRAFT && c.name,
        );
        const childName = (id: unknown) =>
            children.find((c) => String(c._id) === String(id))?.name?.slice(0, 80) ?? null;
        const heightCm = user?.onboarding_data?.height_cm ?? null;

        const perType: Record<string, number> = {};
        const vitals: THealthSummaryPayload["vitals"] = [];
        for (const l of logs as any[]) {
            const seen = (perType[l.logType] ?? 0) + 1;
            perType[l.logType] = seen;
            if (seen > VITALS_PER_TYPE) continue;
            const date = recordDayKey(new Date(l.logDate));
            const f = l.fields ?? {};
            if (l.logType === "bp") {
                vitals.push({
                    type: "bp",
                    value: `${f.systolic}/${f.diastolic}`,
                    unit: "mmHg",
                    date,
                });
            } else if (l.logType === "sugar") {
                vitals.push({
                    type: "sugar",
                    value: String(f.value),
                    unit: "mg/dL",
                    note: SUGAR_TIMING[lang][f.timing] ?? null,
                    date,
                });
            } else if (l.logType === "hb") {
                vitals.push({ type: "hb", value: String(f.value), unit: "g/dL", date });
            } else if (l.logType === "weight") {
                const bmi = bmiFor(Number(f.weightKg), heightCm);
                vitals.push({
                    type: "weight",
                    value: String(f.weightKg),
                    unit: "kg",
                    note: bmi ? `BMI ${bmi}` : null,
                    date,
                });
            }
        }

        return {
            user_id: userId,
            lang,
            child_names: children.map((c) => String(c.name).slice(0, 80)),
            records: records.map((r) => {
                const findings = ((r.summary?.analysis as any)?.findings ?? []) as any[];
                return {
                    record_id: String(r._id),
                    record_date: recordDayKey(r.recordDate),
                    category: r.category,
                    scan_type: r.scanType ?? null,
                    subject:
                        r.subject.type === ERecordSubject.CHILD
                            ? { type: "child" as const, child_name: childName(r.subject.childId) }
                            : { type: "mother" as const },
                    title: r.title ? clip(r.title, 200) : null,
                    digest: clip(r.summary?.digest, 3000),
                    severity: r.summary?.severity ?? "NONE",
                    critical_matches: (r.summary?.criticalMatches ?? []).slice(0, 10),
                    out_of_range: findings
                        .filter((f) => OUT_OF_RANGE.has(f?.status))
                        .slice(0, 25)
                        .map((f) => ({
                            name: clip(f.name, 120),
                            value: clip(f.value, 60),
                            unit: f.unit ? clip(f.unit, 30) : null,
                            reference_range: f.reference_range ? clip(f.reference_range, 80) : null,
                            status: clip(f.status, 20),
                        })),
                };
            }),
            vitals: vitals.slice(0, 20).map((v) => ({ ...v, value: clip(v.value, 40) })),
            medicines: medicines.slice(0, 20).map((m) => ({
                name: clip((m.presetKey && MEDICINE_NAMES[lang][m.presetKey]) || m.name || "", 120),
                frequency: FREQUENCIES[lang][m.frequency] ?? null,
            })),
        };
    }

    async build(summary: IHealthSummary, records: IHealthRecord[]): Promise<void> {
        const userId = String(summary.userId);
        const payload = await this.buildPayload(userId, summary.lang, records);
        const result = await this.llm.buildHealthSummary(payload);
        await healthSummaryModel.updateOne(
            { _id: summary._id, status: EHealthSummaryStatus.PENDING },
            {
                $set: {
                    status: EHealthSummaryStatus.READY,
                    content: result.content ?? null,
                    shareText: result.share_text ?? null,
                },
            },
        );
    }

    async markFailed(summary: IHealthSummary, errorCode: string): Promise<void> {
        const updated = await healthSummaryModel.findOneAndUpdate(
            { _id: summary._id, status: EHealthSummaryStatus.PENDING },
            { $set: { status: EHealthSummaryStatus.FAILED, errorCode } },
            { new: true },
        );
        if (!updated) return;
        const claimed = await healthSummaryModel.findOneAndUpdate(
            { _id: summary._id, quotaRefunded: false },
            { $set: { quotaRefunded: true } },
        );
        if (claimed) {
            await entitlementService
                .refundQuota(String(summary.userId), ECapability.HEALTH_SUMMARY)
                .catch((err) => log.error({ err }, "Summary refund failed"));
        }
    }

    /**
     * Her latest summary, whether it is out of date (records added or deleted since),
     * any summary being built right now, and how many records she has to summarise.
     */
    async latest(userId: string): Promise<{
        summary: TSummaryView | null;
        stale: { newRecords: number; removedRecords: number } | null;
        pending: TSummaryView | null;
        readyRecords: number;
        quota: Awaited<ReturnType<typeof entitlementService.peekQuota>>;
    }> {
        const [summary, pending, readyRecords, quota] = await Promise.all([
            healthSummaryModel
                .findOne({ userId, status: EHealthSummaryStatus.READY })
                .sort({ createdAt: -1 }),
            healthSummaryModel
                .findOne({
                    userId,
                    status: { $in: [EHealthSummaryStatus.PENDING, EHealthSummaryStatus.FAILED] },
                })
                .sort({ createdAt: -1 }),
            healthRecordModel.countDocuments(this.liveReady(userId)),
            entitlementService.peekQuota(userId, ECapability.HEALTH_SUMMARY),
        ]);
        // Only a pending or failed attempt newer than the shown summary is worth surfacing.
        const attempt =
            pending && (!summary || pending.createdAt > summary.createdAt) ? toView(pending) : null;
        if (!summary) return { summary: null, stale: null, pending: attempt, readyRecords, quota };

        const source = summary.sourceRecordIds;
        const [stillThere, newRecords] = await Promise.all([
            healthRecordModel.countDocuments({ ...this.liveReady(userId), _id: { $in: source } }),
            healthRecordModel.countDocuments({ ...this.liveReady(userId), _id: { $nin: source } }),
        ]);
        const removedRecords = source.length - stillThere;
        return {
            summary: toView(summary),
            stale: newRecords || removedRecords ? { newRecords, removedRecords } : null,
            pending: attempt,
            readyRecords,
            quota,
        };
    }

    async get(userId: string, id: string): Promise<TSummaryView> {
        if (!Types.ObjectId.isValid(id)) {
            throw new HealthRecordError(EHealthRecordError.SUMMARY_NOT_FOUND, 404);
        }
        const summary = await healthSummaryModel.findOne({ _id: id, userId });
        if (!summary) throw new HealthRecordError(EHealthRecordError.SUMMARY_NOT_FOUND, 404);
        return toView(summary);
    }

    /** Past summaries, newest first, without their full text. */
    async history(
        userId: string,
        opts: { before?: string | null; limit?: number } = {},
    ): Promise<{ summaries: Omit<TSummaryView, "shareText">[]; nextBefore: string | null }> {
        const limit = Math.min(Math.max(opts.limit ?? 20, 1), 50);
        const filter: Record<string, any> = { userId, status: EHealthSummaryStatus.READY };
        if (opts.before && Types.ObjectId.isValid(opts.before)) {
            filter._id = { $lt: new Types.ObjectId(opts.before) };
        }
        const rows = await healthSummaryModel
            .find(filter)
            .sort({ _id: -1 })
            .limit(limit + 1);
        const page = rows.slice(0, limit);
        return {
            summaries: page.map((s) => {
                const { shareText: _omit, ...rest } = toView(s);
                return rest;
            }),
            nextBefore: rows.length > limit ? String(page[page.length - 1]!._id) : null,
        };
    }

    /** Delete one summary for good. Never refunds. */
    async delete(userId: string, id: string): Promise<void> {
        if (!Types.ObjectId.isValid(id)) {
            throw new HealthRecordError(EHealthRecordError.SUMMARY_NOT_FOUND, 404);
        }
        const { deletedCount } = await healthSummaryModel.deleteOne({ _id: id, userId });
        if (!deletedCount) throw new HealthRecordError(EHealthRecordError.SUMMARY_NOT_FOUND, 404);
    }
}

export const healthSummaryService = new HealthSummaryService();
export default HealthSummaryService;
