// src/logger/index.ts
import { createLogger } from "./pino.config";
import { createHttpLogger, CustomHttpLogger } from "./httpLogger";
import {
    createChildLogger,
    createModuleLogger,
    createRequestLogger,
    createUserLogger,
    createWorkerLogger,
} from "./childLogger";

export const logger = createLogger();

export const httpLogger = createHttpLogger(logger);

export const customHttpLogger = new CustomHttpLogger(logger);

export {
    createChildLogger,
    createModuleLogger,
    createRequestLogger,
    createUserLogger,
    createWorkerLogger,
};

export { createLogger } from "./pino.config";

export default logger;
