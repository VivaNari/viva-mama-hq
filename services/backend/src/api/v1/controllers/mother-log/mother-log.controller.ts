import { NextFunction, Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { isValidObjectId } from "mongoose";

import { messages } from "../../../../constants/messages";
import {
    formatDateToISO,
    getISTCalendarDate,
    parseISODateToStartOfDay,
} from "../../../../services/date/date.service";
import MotherLogService, { bmiFor } from "../../../../services/mother-log/mother-log.service";
import {
    ANC_SCHEDULE_ITEMS,
    APPEND_LOG_TYPES,
    DAILY_LOG_TYPES,
    IMotherLog,
    TAppendLogType,
    TDailyLogType,
    TLogSource,
    TMotherLogType,
} from "../../../../types/mother-log.types";
import sendResponse from "../../../../utils/commonFunctions/sendResponse";

/**
 * Tolerance for a phone clock running fast, as on the feeding log: an entry a minute or
 * two "in the future" by the server's clock is a real entry, not a forged one.
 */
const CLOCK_SKEW_TOLERANCE_MS = 5 * 60 * 1000;
const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 200;

/** Types a history read may ask for. Doses and schedule ticks have their own endpoints. */
const READABLE_TYPES: readonly string[] = [...APPEND_LOG_TYPES, ...DAILY_LOG_TYPES];

/**
 * The mother's logs: readings, kicks, water, meals, pumping and ANC visits.
 *
 * Writes are today-only. The screens have no date picker, and a past day that could
 * still change would make every trend and summary built from it unreliable. Today's
 * entries stay editable until the IST day ends.
 */
export default class MotherLogController {
    private service: MotherLogService;

    constructor() {
        this.service = new MotherLogService();
    }

    private badRequest = (res: Response, message: string) =>
        sendResponse({ data: null, statusCode: StatusCodes.BAD_REQUEST, success: false, message, response: res });

    private notFound = (res: Response, message: string) =>
        sendResponse({ data: null, statusCode: StatusCodes.NOT_FOUND, success: false, message, response: res });

    /** `logDate` goes out as "YYYY-MM-DD"; weight entries carry BMI when height is known. */
    private serialize = (log: IMotherLog, heightCm: number | null) => ({
        _id: log._id,
        logType: log.logType,
        logDate: formatDateToISO(log.logDate),
        loggedAt: log.loggedAt,
        source: log.source,
        fields: log.fields,
        ...(log.logType === "weight" ? { bmi: bmiFor(log.fields.weightKg, heightCm) } : {}),
    });

    getLogs = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { types, from, to, limit } = req.query;

            const requested =
                typeof types === "string" && types.trim()
                    ? types.split(",").map((type) => type.trim())
                    : [];
            if (requested.some((type) => !READABLE_TYPES.includes(type))) {
                return this.badRequest(res, messages.MOTHER_LOG_INVALID_TYPE);
            }

            const fromDate = typeof from === "string" ? parseISODateToStartOfDay(from) : undefined;
            const toDate = typeof to === "string" ? parseISODateToStartOfDay(to) : undefined;
            if (fromDate === null || toDate === null) {
                return this.badRequest(res, messages.MOTHER_LOG_INVALID_DATE);
            }

            const parsedLimit = Number(limit);
            const safeLimit =
                Number.isInteger(parsedLimit) && parsedLimit > 0
                    ? Math.min(parsedLimit, MAX_LIMIT)
                    : DEFAULT_LIMIT;

            const [logs, context] = await Promise.all([
                this.service.list({
                    userId: req.user._id,
                    types: requested as TMotherLogType[],
                    from: fromDate,
                    to: toDate,
                    limit: safeLimit,
                }),
                this.service.getContext(req.user._id),
            ]);

            sendResponse({
                data: logs.map((log) => this.serialize(log as IMotherLog, context.heightCm)),
                totalCount: logs.length,
                statusCode: StatusCodes.OK,
                success: true,
                message: messages.MOTHER_LOG_FETCH_SUCCESS,
                response: res,
            });
        } catch (err) {
            next(err);
        }
    };

    createLog = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { logType, fields, loggedAt, source } = req.body as {
                logType: TAppendLogType;
                fields: Record<string, any>;
                loggedAt?: string;
                source?: TLogSource;
            };

            const at = loggedAt ? new Date(loggedAt) : new Date();
            if (Number.isNaN(at.getTime())) {
                return this.badRequest(res, messages.MOTHER_LOG_INVALID_DATE);
            }
            if (at.getTime() > Date.now() + CLOCK_SKEW_TOLERANCE_MS) {
                return this.badRequest(res, messages.MOTHER_LOG_FUTURE_NOT_ALLOWED);
            }
            if (getISTCalendarDate(at).getTime() !== getISTCalendarDate().getTime()) {
                return this.badRequest(res, messages.MOTHER_LOG_DAY_CLOSED);
            }

            const context = await this.service.getContext(req.user._id);
            const log = await this.service.append({
                userId: req.user._id,
                logType,
                fields,
                loggedAt: at,
                source: source ?? "manual",
                context,
            });

            sendResponse({
                data: this.serialize(log.toObject() as IMotherLog, context.heightCm),
                statusCode: StatusCodes.OK,
                success: true,
                message: messages.MOTHER_LOG_SAVED_SUCCESS,
                response: res,
            });
        } catch (err) {
            next(err);
        }
    };

    setDaily = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { logType, fields, source } = req.body as {
                logType: TDailyLogType;
                fields: Record<string, any>;
                source?: TLogSource;
            };

            const context = await this.service.getContext(req.user._id);
            const log = await this.service.upsertDaily({
                userId: req.user._id,
                logType,
                fields,
                source: source ?? "manual",
                context,
            });

            sendResponse({
                data: log ? this.serialize(log.toObject() as IMotherLog, context.heightCm) : null,
                statusCode: StatusCodes.OK,
                success: true,
                message: messages.MOTHER_LOG_SAVED_SUCCESS,
                response: res,
            });
        } catch (err) {
            next(err);
        }
    };

    deleteLog = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const id = req.params.id as string;
            if (!isValidObjectId(id)) return this.badRequest(res, messages.MOTHER_LOG_INVALID_ID);

            // Scoped by user in the same query, so another user's id reads as not found.
            const log = await this.service.findOwn(req.user._id, id);
            if (!log || !(APPEND_LOG_TYPES as readonly string[]).includes(log.logType)) {
                return this.notFound(res, messages.MOTHER_LOG_NOT_FOUND);
            }
            if (log.logDate.getTime() !== getISTCalendarDate().getTime()) {
                return this.badRequest(res, messages.MOTHER_LOG_DAY_CLOSED);
            }

            await this.service.deleteById(req.user._id, id);

            sendResponse({
                data: { _id: id },
                statusCode: StatusCodes.OK,
                success: true,
                message: messages.MOTHER_LOG_DELETED_SUCCESS,
                response: res,
            });
        } catch (err) {
            next(err);
        }
    };

    getAncSchedule = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const doneItemIds = await this.service.ancScheduleDone(req.user._id);
            sendResponse({
                data: { doneItemIds },
                statusCode: StatusCodes.OK,
                success: true,
                message: messages.MOTHER_LOG_SCHEDULE_FETCH_SUCCESS,
                response: res,
            });
        } catch (err) {
            next(err);
        }
    };

    setAncScheduleItem = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const itemId = req.params.itemId as string;
            if (!(ANC_SCHEDULE_ITEMS as readonly string[]).includes(itemId)) {
                return this.badRequest(res, messages.MOTHER_LOG_SCHEDULE_ITEM_INVALID);
            }

            const context = await this.service.getContext(req.user._id);
            await this.service.setScheduleItem({
                userId: req.user._id,
                itemId,
                done: req.body.done,
                context,
            });
            const doneItemIds = await this.service.ancScheduleDone(req.user._id);

            sendResponse({
                data: { doneItemIds },
                statusCode: StatusCodes.OK,
                success: true,
                message: messages.MOTHER_LOG_SAVED_SUCCESS,
                response: res,
            });
        } catch (err) {
            next(err);
        }
    };
}
