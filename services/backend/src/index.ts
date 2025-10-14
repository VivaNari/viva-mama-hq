import dotenv from "dotenv";
dotenv.config();

import app from "./app";
import env from "./config/env";
import connectDb from "./config/db";

connectDb();

app.listen(env.PORT, () => {
    console.log("info --", `\x1b[33m \x1b[1m Server is running on port ${env.PORT} \x1b[0m`);
});
