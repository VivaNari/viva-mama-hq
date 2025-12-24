import cors from "cors";
import express from "express";
import router from "./api/v1/routes";
import childRouter from "./api/v1/routes/childs/child.route";
import userRouter from "./api/v1/routes/users/user.route";
import { correlationIdMiddleware } from "./middlewares/correlationId.middleware";
import errorHandler from "./middlewares/errorHandler.middleware";
import { requestLoggerMiddleware } from "./middlewares/requestLogger.middleware";

const app = express();

app.use(cors());
app.use(express.json());

app.use(correlationIdMiddleware);
app.use(requestLoggerMiddleware);

app.get("/", (_, res) => {
    res.status(200).json({ message: "You have reached the root api endpoint" });
});

app.get("/health", (_, res) => {
    res.status(200).json({ status: "ok" });
});

app.use("/api/v1", userRouter);
app.use("/api/v1", childRouter);
app.use("/api/v1", router);

app.use(errorHandler);

export default app;
