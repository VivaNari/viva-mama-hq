import express from "express";
import cors from "cors";
import router from "./api/routes/flow-definition.routes";
import flowNodeCategoryRouter from "./api/routes/flow-node-category.route";
import chatFlowRouter from "./api/routes/chat-flow.routes";
const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/v1", router);
app.use("/api/v1", flowNodeCategoryRouter);
app.use("/api/v1", chatFlowRouter);

export default app;
