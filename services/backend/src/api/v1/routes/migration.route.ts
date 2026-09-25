import { Router } from "express";
import cloudSchedulerMiddleware from "../../../middlewares/cloudScheduler.middleware";
import { runAllMigrationsController } from "../controllers/migration/migration.controller";

const migrationRouter = Router();

/**
 * POST /api/v1/admin/migrate/run-all
 *
 * Runs every migration step in sequence. Idempotent — safe to call repeatedly.
 *
 * Guarded by cloudSchedulerMiddleware (Google OIDC, with a dev-only `x-cron-secret`
 * bypass), NOT by authMiddleware. It previously accepted any valid user JWT, which
 * meant any logged-in user could trigger a full migration run against production —
 * reshaping the content catalog and rewriting the subscription snapshot on every user
 * document. A schema migration is an operator action, not a user action.
 *
 * To run locally: POST with header `x-cron-secret: <CRON_DEV_SECRET>`.
 */
migrationRouter.post(
    "/admin/migrate/run-all",
    cloudSchedulerMiddleware,
    runAllMigrationsController,
);

export default migrationRouter;
