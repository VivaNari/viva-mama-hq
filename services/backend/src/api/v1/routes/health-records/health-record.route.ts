import { Router } from "express";

import env from "../../../../config/env";
import authMiddleware from "../../../../middlewares/authorization.middleware";
import requestValidator from "../../../../middlewares/requestValidator.middleware";
import { makeSingleUpload } from "../../../../middlewares/upload.middleware";
import HealthRecordController, {
    requireHealthRecords,
    requireHealthRecordsConsent,
} from "../../controllers/health-records/health-record.controller";
import {
    createHealthRecordValidator,
    deleteHealthRecordsValidator,
    generateHealthSummaryValidator,
    healthRecordConsentValidator,
    submitHealthRecordValidator,
    updateHealthRecordValidator,
} from "../../validators/health-records/health-record.validator";

/** Her saved scans, lab reports, prescriptions and MCH card, and the overall summary. */
const healthRecordRouter = Router();
const controller = new HealthRecordController();
const auth = authMiddleware("header");
const pageUpload = makeSingleUpload({ maxBytes: env.HEALTH_RECORD_MAX_BYTES });

healthRecordRouter.get("/health-records/config", auth, controller.getConfig);

healthRecordRouter.post(
    "/health-records/consent",
    auth,
    requireHealthRecords,
    requestValidator(healthRecordConsentValidator),
    controller.acceptConsent,
);

// ── Overall summary (before /:id so "summary" is never read as a record id) ─────
healthRecordRouter.post(
    "/health-records/summary",
    auth,
    requireHealthRecords,
    requestValidator(generateHealthSummaryValidator),
    controller.generateSummary,
);
healthRecordRouter.get("/health-records/summary/latest", auth, controller.latestSummary);
healthRecordRouter.get("/health-records/summary/history", auth, controller.summaryHistory);
healthRecordRouter.get("/health-records/summary/:id", auth, controller.getSummary);
healthRecordRouter.delete("/health-records/summary/:id", auth, controller.deleteSummary);

// ── Records ─────────────────────────────────────────────────────────────────────
healthRecordRouter.get("/health-records", auth, controller.list);

healthRecordRouter.post(
    "/health-records",
    auth,
    requireHealthRecords,
    requireHealthRecordsConsent,
    requestValidator(createHealthRecordValidator),
    controller.create,
);

healthRecordRouter.post(
    "/health-records/delete",
    auth,
    requestValidator(deleteHealthRecordsValidator),
    controller.removeMany,
);

healthRecordRouter.get("/health-records/:id", auth, controller.get);

healthRecordRouter.patch(
    "/health-records/:id",
    auth,
    requestValidator(updateHealthRecordValidator),
    controller.update,
);

healthRecordRouter.delete("/health-records/:id", auth, controller.remove);

// Auth, the feature gate and consent run before multer, so nobody's bytes are
// buffered until we know the upload is allowed.
healthRecordRouter.post(
    "/health-records/:id/files",
    auth,
    requireHealthRecords,
    requireHealthRecordsConsent,
    pageUpload,
    controller.addFile,
);

healthRecordRouter.delete("/health-records/:id/files/:fileId", auth, controller.removeFile);

healthRecordRouter.get("/health-records/:id/files/:fileId/url", auth, controller.fileUrl);

healthRecordRouter.post(
    "/health-records/:id/submit",
    auth,
    requireHealthRecords,
    requestValidator(submitHealthRecordValidator),
    controller.submit,
);

healthRecordRouter.post("/health-records/:id/retry", auth, requireHealthRecords, controller.retry);

export default healthRecordRouter;
