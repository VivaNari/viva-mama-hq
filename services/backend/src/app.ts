import express from "express";
import cors from "cors";
import router from "./api/v1/routes";
import userRouter from "./api/v1/routes/users/user.route";
import questionRouter from "./api/v1/routes/questions/question.route";
import childRouter from "./api/v1/routes/childs/child.route";
import answerRouter from "./api/v1/routes/answers/answer.route";
import { correlationIdMiddleware } from "./middlewares/correlationId.middleware";
import { requestLoggerMiddleware } from "./middlewares/requestLogger.middleware";
import errorHandler from "./middlewares/errorHandler.middleware";
import testRouter from "./api/v1/routes/test.route";

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
app.use("/api/v1", questionRouter);
app.use("/api/v1", answerRouter);
app.use("/api/v1", router);
app.use("/api/v1", testRouter);

app.use(errorHandler);

export default app;
