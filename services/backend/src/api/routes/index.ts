import Express from "express";

const app = Express();

app.use("/chat/flow-definition", require("./flow-definition.index"));

module.exports = app;