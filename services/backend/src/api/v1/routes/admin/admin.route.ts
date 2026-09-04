import { Router } from "express";
import adminAuthMiddleware from "../../../../middlewares/adminAuthorization.middleware";
import requestValidator from "../../../../middlewares/requestValidator.middleware";
import { AdminController } from "../../controllers/admin/admin.controller";
import ReferralAdminController from "../../controllers/admin/referral-admin.controller";
import { adminLoginValidator } from "../../validators/admin/admin.validator";
import {
    addSeatsValidator,
    createOrganizationValidator,
    createReferralProgramValidator,
    updateOrganizationValidator,
    updateReferralProgramValidator,
} from "../../validators/admin/referral.validator";
import { confirmMeetingTimeValidator } from "../../validators/consultations/consultation.validator";
import { actionReportValidator } from "../../validators/vivaClub/moderation.validator";

/**
 * Mounted at `/api/v1/admin` in app.ts, so every path here is relative to that.
 *
 * Everything except login sits behind `adminAuthMiddleware`, which demands a
 * SUPER_ADMIN role claim *and* re-checks the role in the database — an ordinary
 * patient's token is signed with the same secret and would otherwise pass.
 */
const adminRouter = Router();
const adminController = new AdminController();
const referralAdminController = new ReferralAdminController();

adminRouter.post("/auth/login", requestValidator(adminLoginValidator), adminController.login);
adminRouter.get("/auth/me", adminAuthMiddleware, adminController.getProfile);

adminRouter.get("/consultations", adminAuthMiddleware, adminController.listConsultations);

// Sets the exact 30-minute start agreed with the consultant. This is what unlocks the
// patient's Join button, five minutes ahead of the call.
adminRouter.patch(
    "/consultations/:id/confirm-time",
    adminAuthMiddleware,
    requestValidator(confirmMeetingTimeValidator),
    adminController.confirmMeetingTime,
);
adminRouter.put(
    "/consultations/:id/completed",
    adminAuthMiddleware,
    adminController.completeConsultation,
);
adminRouter.put("/consultations/:id/unhandled", adminAuthMiddleware, adminController.markUnhandled);

// ── Moderation queue ────────────────────────────────────────────────────────────
// The half of the UGC policy that lives behind the report button: reports have to be
// reviewable and actionable, or "robust, effective, and ongoing" moderation is a claim
// with nothing behind it.
adminRouter.get("/reports", adminAuthMiddleware, adminController.listReports);
adminRouter.patch(
    "/reports/:id",
    adminAuthMiddleware,
    requestValidator(actionReportValidator),
    adminController.actionReport,
);

// ── Referral programs ───────────────────────────────────────────────────────────
// The configuration surface for codes that carry benefits: which plan a code grants,
// which capabilities it suppresses, and how many seats an organization bought.
//
// Mounted here rather than on a router of its own because this is the only admin
// surface in the codebase that actually enforces SUPER_ADMIN.
adminRouter.post(
    "/organizations",
    adminAuthMiddleware,
    requestValidator(createOrganizationValidator),
    referralAdminController.createOrganization,
);
adminRouter.get("/organizations", adminAuthMiddleware, referralAdminController.listOrganizations);
adminRouter.get(
    "/organizations/:id",
    adminAuthMiddleware,
    referralAdminController.getOrganization,
);
adminRouter.patch(
    "/organizations/:id",
    adminAuthMiddleware,
    requestValidator(updateOrganizationValidator),
    referralAdminController.updateOrganization,
);

adminRouter.post(
    "/referral-programs",
    adminAuthMiddleware,
    requestValidator(createReferralProgramValidator),
    referralAdminController.createProgram,
);
adminRouter.get("/referral-programs", adminAuthMiddleware, referralAdminController.listPrograms);
adminRouter.get(
    "/referral-programs/:id",
    adminAuthMiddleware,
    referralAdminController.getProgram,
);
adminRouter.patch(
    "/referral-programs/:id",
    adminAuthMiddleware,
    requestValidator(updateReferralProgramValidator),
    referralAdminController.updateProgram,
);
// Additive, and the only way to change a pool — see the validator for why PATCH refuses.
adminRouter.post(
    "/referral-programs/:id/seats",
    adminAuthMiddleware,
    requestValidator(addSeatsValidator),
    referralAdminController.addSeats,
);
adminRouter.get(
    "/referral-programs/:id/usage",
    adminAuthMiddleware,
    referralAdminController.programUsage,
);

adminRouter.get(
    "/referral-redemptions",
    adminAuthMiddleware,
    referralAdminController.listRedemptions,
);
adminRouter.post(
    "/referral-redemptions/:id/retry-grant",
    adminAuthMiddleware,
    referralAdminController.retryGrant,
);
adminRouter.delete(
    "/referral-redemptions/:id",
    adminAuthMiddleware,
    referralAdminController.revokeRedemption,
);

export default adminRouter;
