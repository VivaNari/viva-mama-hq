import { NextFunction, Request, Response } from "express";
import multer from "multer";

import env from "../config/env";
import { messages } from "../constants/messages";
import { EAttachmentError } from "../types/chat-attachment.types";

/**
 * Multipart parsing for a single chat attachment, held in memory.
 *
 * Memory is fine at this size (one file, capped) and lets the file be validated and
 * cleaned before a byte of it is stored anywhere. What memory cannot absorb is many at
 * once, so uploads per instance are capped; past the cap the app is told to retry.
 */
const MAX_CONCURRENT_UPLOADS = 4;
let inFlight = 0;

export const sendAttachmentError = (
    res: Response,
    status: number,
    code: EAttachmentError | string,
): void => {
    res.status(status).json({
        // `data.code` as well as `code`: the app ends the session on any 403 that does
        // not carry a string `data.code`, and these 403s mean "not for you", not that.
        data: { code },
        code,
        message: (messages as Record<string, string>)[code] ?? code,
        success: false,
        statusCode: status,
    });
};

const parser = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: env.CHAT_ATTACHMENT_MAX_BYTES,
        files: 1,
        fields: 4,
        parts: 6,
        fieldSize: 1024,
    },
}).single("file");

export const singleAttachmentUpload = (req: Request, res: Response, next: NextFunction) => {
    if (inFlight >= MAX_CONCURRENT_UPLOADS) {
        res.setHeader("Retry-After", "2");
        return sendAttachmentError(res, 503, EAttachmentError.BUSY);
    }
    inFlight += 1;
    let released = false;
    const release = () => {
        if (!released) {
            released = true;
            inFlight -= 1;
        }
    };
    res.on("finish", release);
    res.on("close", release);

    parser(req, res, (err: unknown) => {
        if (!err) return next();
        if (err instanceof multer.MulterError) {
            if (err.code === "LIMIT_FILE_SIZE") {
                return sendAttachmentError(res, 413, EAttachmentError.TOO_LARGE);
            }
            return sendAttachmentError(res, 400, EAttachmentError.MISSING);
        }
        return next(err);
    });
};
