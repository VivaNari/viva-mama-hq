import { getStorage } from "../config/gcs.config";
import chatAttachmentModel from "../models/chat-attachment.model";
import pendingGcsPurgeModel from "../models/pending-gcs-purge.model";
import { chatAttachmentService } from "../services/chat-system/chat-attachment.service";
import { EAttachmentStatus } from "../types/chat-attachment.types";
import logger, { createModuleLogger } from "../utils/logger";

const log = createModuleLogger(logger, "chat-attachment-janitor");

/** A file uploaded but never sent (she closed the app, removed it, lost signal). */
const ORPHAN_AFTER_MS = 24 * 60 * 60 * 1000;
const BATCH = 200;
const MAX_PURGE_ATTEMPTS = 20;

/**
 * Hourly. Keeps stored files to the ones a turn actually used:
 *   - uploaded but never sent within 24h: deleted
 *   - refused or failed, where deleting the object did not go through: retried
 *   - accounts deleted while storage was down: their prefix is purged
 * Retention itself (90 days) is the bucket's lifecycle rule, not this job.
 */
export const chatAttachmentJanitor = async (now: Date = new Date()) => {
    const result = { orphans: 0, retried: 0, purgedPrefixes: 0, failures: 0 };
    try {
        const orphans = await chatAttachmentModel
            .find({
                status: EAttachmentStatus.UPLOADED,
                createdAt: { $lt: new Date(now.getTime() - ORPHAN_AFTER_MS) },
            })
            .limit(BATCH);
        for (const attachment of orphans) {
            await chatAttachmentService.deleteObject(attachment);
            result.orphans += 1;
        }

        // deleteObject only stamps deletedAt once storage confirmed the delete.
        const leftovers = await chatAttachmentModel
            .find({
                status: { $in: [EAttachmentStatus.REJECTED, EAttachmentStatus.FAILED] },
                deletedAt: null,
            })
            .limit(BATCH);
        for (const attachment of leftovers) {
            await chatAttachmentService.deleteObject(attachment, attachment.status);
            result.retried += 1;
        }

        const purges = await pendingGcsPurgeModel
            .find({ attempts: { $lt: MAX_PURGE_ATTEMPTS } })
            .limit(BATCH);
        for (const purge of purges) {
            try {
                await getStorage()
                    .bucket(purge.bucket)
                    .deleteFiles({ prefix: purge.prefix, force: true });
                await pendingGcsPurgeModel.deleteOne({ _id: purge._id });
                result.purgedPrefixes += 1;
            } catch (error) {
                result.failures += 1;
                await pendingGcsPurgeModel.updateOne(
                    { _id: purge._id },
                    {
                        $inc: { attempts: 1 },
                        $set: {
                            lastError: String((error as Error)?.message ?? error).slice(0, 300),
                        },
                    },
                );
            }
        }
        log.info(result, "Chat attachment janitor finished");
    } catch (error) {
        log.error({ err: error }, "Chat attachment janitor failed");
    }
    return result;
};
