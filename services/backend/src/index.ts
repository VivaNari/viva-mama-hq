import dotenv from "dotenv";
dotenv.config();

import app from "./app";
import env from "./config/env";
import connectDb from "./config/db";
import { initScheduledJobs } from "./jobs";
import http from "http";
import { initFirebaseAdmin } from "./config/firebase";
import { initSocketIO } from "./config/socket";

connectDb();
initFirebaseAdmin();

// Create http server and pass the express app through it
const server = http.createServer(app);

// initialize socket.io server
initSocketIO(server);

server.listen(env.PORT, () => {
    console.log("info", `\x1b[33m \x1b[1m Server is running on port ${env.PORT} \x1b[0m`);
    initScheduledJobs();
});
