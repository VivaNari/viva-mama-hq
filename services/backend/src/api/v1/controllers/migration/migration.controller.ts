import { Request, Response } from "express";
import { runAllMigrations } from "../../../../services/migration/migration.service";
/**
 * POST /api/v1/admin/migrate/run-all
 *
 * Triggers all Hindi i18n migrations in sequence.
 * Protected by ADMIN_SECRET header check in the route layer.
 *
 * Returns a JSON summary of each step's outcome so the caller can see
 * exactly what succeeded and what (if anything) failed, without having
 * to watch server logs.
 */
export const runAllMigrationsController = async (_req: Request, res: Response): Promise<void> => {
    try {
        console.log("[MigrationController] Received run-all-migrations request");
        const result = await runAllMigrations();

        const statusCode = result.success ? 200 : 207; // 207 Multi-Status for partial failures
        res.status(statusCode).json({
            success: result.success,
            message: result.success
                ? "All migrations completed successfully."
                : "Some migrations failed — check the steps array for details.",
            durationMs: result.durationMs,
            steps: result.steps,
        });
    } catch (err: any) {
        console.error("[MigrationController] Unexpected error:", err);
        res.status(500).json({
            success: false,
            message: "Unexpected error running migrations",
            error: err?.message ?? String(err),
        });
    }
};
