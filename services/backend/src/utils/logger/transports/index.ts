// src/logger/transports/index.ts
import pino, { type transport } from "pino";
import { createPrettyTransport } from "./pretty.transport";
import env from "../../../config/env";

export function getTransports(): ReturnType<typeof pino.transport> | pino.DestinationStream {
    const targets: any[] = [];

    if (env.isDevelopment() || env.LOG_PRETTY_PRINT) {
        targets.push(createPrettyTransport());
    } else {
        targets.push({
            target: "pino/file",
            options: { destination: 1 },
        });
    }

    if (env.isProduction() || env.LOG_TO_FILE === true) {
        targets.push({
            target: "pino/file",
            options: {
                destination: `${env.LOG_FILE_PATH}/app.log`,
                mkdir: true,
            },
        });

        targets.push({
            target: "pino/file",
            level: "error",
            options: {
                destination: `${env.LOG_FILE_PATH}/error.log`,
                mkdir: true,
            },
        });
    }

    if (targets.length === 0) {
        return pino.destination(1);
    } else if (targets.length === 1) {
        return pino.transport(targets[0]);
    } else {
        return pino.transport({
            targets,
            dedupe: true,
        });
    }
}

export * from "./pretty.transport";
