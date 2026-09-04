import cors from "cors";
import express from "express";
import router from "./api/v1/routes";
import adminRouter from "./api/v1/routes/admin/admin.route";
import childRouter from "./api/v1/routes/childs/child.route";
import userRouter from "./api/v1/routes/users/user.route";
import vivaClubRouter from "./api/v1/routes/vivaClub/vivaClub.route";
import migrationRouter from "./api/v1/routes/migration.route";
import cronJobsRouter from "./api/v1/routes/cron-jobs/cron-jobs.route";
import { correlationIdMiddleware } from "./middlewares/correlationId.middleware";
import errorHandler from "./middlewares/errorHandler.middleware";
import { requestLoggerMiddleware } from "./middlewares/requestLogger.middleware";

const app = express();

app.use(cors());
app.use(
    express.json({
        // Webhook signatures are computed over the exact bytes the provider sent.
        // Re-serialising the parsed object would change key order and whitespace, so the
        // HMAC would never match — the raw buffer has to be kept before parsing.
        // Scoped to webhook paths so nothing else pays the memory cost.
        verify: (req, _res, buf) => {
            if (req.url?.startsWith("/api/v1/webhooks/")) {
                (req as express.Request & { rawBody?: Buffer }).rawBody = buf;
            }
        },
    }),
);

app.use(correlationIdMiddleware);
app.use(requestLoggerMiddleware);

app.get("/", (_, res) => {
    res.status(200).json({ message: "Ye, you have reached the root api endpoint" });
});

app.get("/health", (_, res) => {
    res.status(200).json({ status: "ok" });
});

app.use("/api/v1", userRouter);
app.use("/api/v1", childRouter);
app.use("/api/v1/viva-club", vivaClubRouter);
app.use("/api/v1", migrationRouter);
app.use("/api/v1/internal/jobs", cronJobsRouter);
// Ahead of the aggregator so its `/admin/experts`-style paths cannot shadow the
// admin-guarded surface.
app.use("/api/v1/admin", adminRouter);
app.use("/api/v1", router);

app.use(errorHandler);

export default app;
