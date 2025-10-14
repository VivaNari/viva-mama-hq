import express from "express";
import cors from "cors";
import userRouter from "./api/v1/routes/users/user.route";

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (_, res) => {
    res.json({ message: "You have reached the root api endpoint" });
});

app.use("/api/v1", userRouter);

export default app;
