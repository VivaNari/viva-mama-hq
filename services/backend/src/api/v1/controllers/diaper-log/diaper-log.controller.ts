import { NextFunction, Request, Response } from "express";
import { StatusCodes } from "http-status-codes";

import { messages } from "../../../../constants/messages";
import DiaperLogService, {
    ChildNotFoundError,
    totalsFor,
} from "../../../../services/diaper-log/diaper-log.service";
import {
    formatDateToISO,
    getISTCalendarDate,
    parseISODateToStartOfDay,
} from "../../../../services/date/date.service";
import { IDiaperLog } from "../../../../types/diaper-log.types";
import sendResponse from "../../../../utils/commonFunctions/sendResponse";

/**
 * Tolerance for a phone clock running fast.
 *
 * Unlike the growth log, which compares whole dates, this compares instants — so a device a
 * minute or two ahead of the server would have a genuine tap rejected as "in the future".
 * Five minutes absorbs ordinary drift while still refusing a date that is actually wrong.
 */
const CLOCK_SKEW_TOLERANCE_MS = 5 * 60 * 1000;

export default class DiaperLogController {
    private diaperLogService: DiaperLogService;

    constructor() {
        this.diaperLogService = new DiaperLogService();
    }

    /** `loggedOn` goes out as "YYYY-MM-DD", the shape the client keys its date strip on. */
    private serialize = (entry: IDiaperLog) => ({
        _id: entry._id,
        childId: entry.childId,
        loggedOn: formatDateToISO(entry.loggedOn),
        entries: (entry.entries ?? []).map((item) => ({
            _id: item._id,
            kind: item.kind,
            loggedAt: item.loggedAt,
        })),
        totals: totalsFor(entry.entries ?? []),
        createdAt: entry.createdAt,
        updatedAt: entry.updatedAt,
    });

    private badRequest = (res: Response, message: string) =>
        sendResponse({
            data: null,
            statusCode: StatusCodes.BAD_REQUEST,
            success: false,
            message,
            response: res,
        });

    private notFound = (res: Response, message: string) =>
        sendResponse({
            data: null,
            statusCode: StatusCodes.NOT_FOUND,
            success: false,
            message,
            response: res,
        });

    createDiaperLogEntry = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { childId, kind, loggedAt } = req.body;

            const instant = new Date(loggedAt);
            if (Number.isNaN(instant.getTime())) {
                return this.badRequest(res, messages.DIAPER_LOG_INVALID_DATE);
            }

            // A change cannot have happened in the future.
            if (instant.getTime() > Date.now() + CLOCK_SKEW_TOLERANCE_MS) {
                return this.badRequest(res, messages.DIAPER_LOG_FUTURE_NOT_ALLOWED);
            }

            // Today's entries are editable until the IST day ends; earlier days are closed.
            //
            // Enforced here rather than only in the app, where it would be decoration: the
            // UI hides the quick-log tiles on a past day, but without this the endpoint
            // would accept any past instant and the rule would hold only until somebody
            // called the API directly.
            const loggedOn = getISTCalendarDate(instant);
            if (loggedOn.getTime() !== getISTCalendarDate().getTime()) {
                return this.badRequest(res, messages.DIAPER_LOG_DAY_CLOSED);
            }

            const child = await this.diaperLogService.getOwnedChild(req.user._id, childId);

            // Nor before the child existed.
            if (child.date_of_birth) {
                const birthDay = getISTCalendarDate(new Date(child.date_of_birth));
                if (loggedOn.getTime() < birthDay.getTime()) {
                    return this.badRequest(res, messages.DIAPER_LOG_BEFORE_BIRTH);
                }
            }

            const result = await this.diaperLogService.addEntry({
                userId: req.user._id,
                childId,
                kind,
                loggedAt: instant,
            });

            return sendResponse({
                data: {
                    childId,
                    loggedOn: formatDateToISO(result.loggedOn),
                    entry: result.entry,
                    totals: result.totals,
                },
                statusCode: StatusCodes.OK,
                success: true,
                message: messages.DIAPER_LOG_SAVED_SUCCESS,
                response: res,
            });
        } catch (error) {
            if (error instanceof ChildNotFoundError) {
                return this.notFound(res, messages.DIAPER_LOG_CHILD_NOT_FOUND);
            }
            return next(error);
        }
    };

    getChildDiaperLogs = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const childId = typeof req.query.childId === "string" ? req.query.childId : "";
            if (!childId) {
                return this.badRequest(res, messages.DIAPER_LOG_CHILD_NOT_FOUND);
            }

            // Parsed here rather than by requestValidator, which only inspects req.body.
            const from =
                typeof req.query.from === "string"
                    ? parseISODateToStartOfDay(req.query.from)
                    : null;
            const to =
                typeof req.query.to === "string"
                    ? parseISODateToStartOfDay(req.query.to)
                    : null;

            if ((req.query.from && !from) || (req.query.to && !to)) {
                return this.badRequest(res, messages.DIAPER_LOG_INVALID_DATE);
            }

            const logs = await this.diaperLogService.listForChild({
                userId: req.user._id,
                childId,
                ...(from ? { from } : {}),
                ...(to ? { to } : {}),
            });

            return sendResponse({
                data: logs.map(this.serialize),
                totalCount: logs.length,
                statusCode: StatusCodes.OK,
                success: true,
                message: messages.DIAPER_LOG_FETCH_SUCCESS,
                response: res,
            });
        } catch (error) {
            if (error instanceof ChildNotFoundError) {
                return this.notFound(res, messages.DIAPER_LOG_CHILD_NOT_FOUND);
            }
            return next(error);
        }
    };

    deleteDiaperLogEntry = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { childId, loggedOn, entryId } = req.body;

            const parsedDate = parseISODateToStartOfDay(loggedOn);
            if (!parsedDate) {
                return this.badRequest(res, messages.DIAPER_LOG_INVALID_DATE);
            }

            // Removing from a past day is the same act as adding to it.
            if (parsedDate.getTime() !== getISTCalendarDate().getTime()) {
                return this.badRequest(res, messages.DIAPER_LOG_DAY_CLOSED);
            }

            const { removed, totals } = await this.diaperLogService.removeEntry({
                userId: req.user._id,
                childId,
                loggedOn: parsedDate,
                entryId,
            });

            if (!removed) {
                return this.notFound(res, messages.DIAPER_LOG_NOT_FOUND);
            }

            return sendResponse({
                data: { childId, loggedOn, entryId, totals },
                statusCode: StatusCodes.OK,
                success: true,
                message: messages.DIAPER_LOG_DELETED_SUCCESS,
                response: res,
            });
        } catch (error) {
            if (error instanceof ChildNotFoundError) {
                return this.notFound(res, messages.DIAPER_LOG_CHILD_NOT_FOUND);
            }
            return next(error);
        }
    };
}
