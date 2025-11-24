import { TransportTargetOptions } from "pino";

export function createPrettyTransport(): TransportTargetOptions {
    return {
        target: "pino-pretty",
        options: {
            colorize: true,
            translateTime: "HH:MM:ss Z",
            ignore: "pid,hostname",
            singleLine: false,
            levelFirst: true,
            messageFormat: "{levelLabel} - {msg}",
            errorLikeObjectKeys: ["err", "error"],
            errorProps: "message,stack,code,statusCode",
            customColors: "error:red,warn:yellow,info:green,debug:blue",
            customLevels: {
                fatal: 60,
                error: 50,
                warn: 40,
                info: 30,
                debug: 20,
                trace: 10,
            },
        },
    };
}
