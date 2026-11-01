import healthRecordModel from "../models/health-record.model";
import healthSummaryModel from "../models/health-summary.model";
import { healthRecordService } from "../services/health-records/health-record.service";
import {
    healthSummaryService,
    SUMMARY_PENDING_TIMEOUT_MS,
} from "../services/health-records/health-summary.service";
import { EHealthRecordStatus, EHealthSummaryStatus } from "../types/health-record.types";
import logger, { createModuleLogger } from "../utils/logger";

const log = createModuleLogger(logger, "health-records-janitor");

/** A record started but never submitted (she closed the app, lost signal). */
const DRAFT_AFTER_MS = 24 * 60 * 60 * 1000;
/** Longer than the chatbot's worst case for one record, so only a lost read is caught. */
const PROCESSING_AFTER_MS = 10 * 60 * 1000;
const BATCH = 200;

/**
 * Hourly. Keeps records and summaries from getting stuck:
 *   - drafts never submitted within 24h: deleted with their pages
 *   - records still PROCESSING after 10 min (the instance died mid-read): FAILED and
 *     refunded, so she can retry
 *   - summaries still PENDING after 10 min: FAILED and refunded
 * Prefixes whose delete failed are retried by the chat attachment janitor, which
 * handles pending_gcs_purges for every bucket.
 */
export const healthRecordsJanitor = async (now: Date = new Date()) => {
    const result = { drafts: 0, stuckRecords: 0, stuckSummaries: 0, failures: 0 };
    try {
        const drafts = await healthRecordModel
            .find({
                status: EHealthRecordStatus.DRAFT,
                updatedAt: { $lt: new Date(now.getTime() - DRAFT_AFTER_MS) },
            })
            .select("_id userId")
            .limit(BATCH)
            .lean();
        for (const draft of drafts) {
            try {
                result.drafts += await healthRecordService.deleteMany(String(draft.userId), [
                    String(draft._id),
                ]);
            } catch (error) {
                result.failures += 1;
                log.error({ err: error, recordId: String(draft._id) }, "Deleting a draft failed");
            }
        }

        const stuck = await healthRecordModel
            .find({
                status: EHealthRecordStatus.PROCESSING,
                deletedAt: null,
                submittedAt: { $lt: new Date(now.getTime() - PROCESSING_AFTER_MS) },
            })
            .limit(BATCH);
        for (const record of stuck) {
            await healthRecordService.markFailed(record, "TIMEOUT");
            result.stuckRecords += 1;
        }

        const pending = await healthSummaryModel
            .find({
                status: EHealthSummaryStatus.PENDING,
                createdAt: { $lt: new Date(now.getTime() - SUMMARY_PENDING_TIMEOUT_MS) },
            })
            .limit(BATCH);
        for (const summary of pending) {
            await healthSummaryService.markFailed(summary, "TIMEOUT");
            result.stuckSummaries += 1;
        }
        log.info(result, "Health records janitor finished");
    } catch (error) {
        log.error({ err: error }, "Health records janitor failed");
    }
    return result;
};
