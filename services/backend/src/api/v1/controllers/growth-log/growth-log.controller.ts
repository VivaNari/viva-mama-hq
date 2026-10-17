import { NextFunction, Request, Response } from "express";
import { StatusCodes } from "http-status-codes";

import { messages } from "../../../../constants/messages";
import {
    formatDateToISO,
    getISTCalendarDate,
    parseISODateToStartOfDay,
} from "../../../../services/date/date.service";
import GrowthLogService, {
    ChildNotFoundError,
} from "../../../../services/growth-log/growth-log.service";
import { IGrowthLog } from "../../../../types/growth-log.types";
import sendResponse from "../../../../utils/commonFunctions/sendResponse";

export default class GrowthLogController {
    private growthLogService: GrowthLogService;

    constructor() {
        this.growthLogService = new GrowthLogService();
    }

    /** `measuredOn` goes out as "YYYY-MM-DD", the same shape the client sends it in. */
    private serialize = (entry: IGrowthLog) => ({
        _id: entry._id,
        childId: entry.childId,
        measuredOn: formatDateToISO(entry.measuredOn),
        ageInDays: entry.ageInDays,
        sex: entry.sex,
        measurements: entry.measurements,
        percentiles: entry.percentiles,
        standard: entry.standard,
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

    createOrUpdateGrowthLog = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { childId, measuredOn, weight_kg, length_cm, head_circumference_cm } =
                req.body;

            const parsedDate = parseISODateToStartOfDay(measuredOn);
            if (!parsedDate) {
                return this.badRequest(res, messages.GROWTH_LOG_INVALID_DATE);
            }

            // A measurement cannot be taken in the future.
            if (parsedDate.getTime() > getISTCalendarDate().getTime()) {
                return this.badRequest(res, messages.GROWTH_LOG_FUTURE_NOT_ALLOWED);
            }

            // Today's entry is editable until the IST day ends; earlier days are closed.
            //
            // Enforced here rather than only in the app, where it was decoration: the UI
            // hid the Save button on a past day, but the endpoint accepted any past date,
            // so the rule held only for as long as nobody called the API directly.
            //
            // Deliberately on the HTTP boundary, not in the service — the day-0 entry
            // written when baby onboarding completes is dated the child's birthday, and
            // recomputing after a corrected date of birth rewrites historical rows. Both
            // are trusted internal writes and must keep working.
            if (parsedDate.getTime() !== getISTCalendarDate().getTime()) {
                return this.badRequest(res, messages.GROWTH_LOG_DAY_CLOSED);
            }

            const child = await this.growthLogService.getOwnedChild(req.user._id, childId);

            // Nor before the child existed. Without this the age would floor at 0 and the
            // entry would silently score as a newborn's.
            if (child.date_of_birth) {
                const birthDay = getISTCalendarDate(new Date(child.date_of_birth));
                if (parsedDate.getTime() < birthDay.getTime()) {
                    return this.badRequest(res, messages.GROWTH_LOG_BEFORE_BIRTH);
                }
            }

            const growthLog = await this.growthLogService.upsertForDate({
                userId: req.user._id,
                childId,
                measuredOn: parsedDate,
                measurement: {
                    weight_kg: weight_kg ?? null,
                    length_cm: length_cm ?? null,
                    head_circumference_cm: head_circumference_cm ?? null,
                },
            });

            return sendResponse({
                data: this.serialize(growthLog),
                statusCode: StatusCodes.OK,
                success: true,
                message: messages.GROWTH_LOG_SAVED_SUCCESS,
                response: res,
            });
        } catch (error) {
            if (error instanceof ChildNotFoundError) {
                return this.notFound(res, messages.GROWTH_LOG_CHILD_NOT_FOUND);
            }
            return next(error);
        }
    };

    getChildGrowthLogs = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const childId = typeof req.query.childId === "string" ? req.query.childId : "";
            if (!childId) {
                return this.badRequest(res, messages.GROWTH_LOG_CHILD_NOT_FOUND);
            }

            // Validated here rather than by requestValidator, which only inspects req.body.
            const from =
                typeof req.query.from === "string"
                    ? parseISODateToStartOfDay(req.query.from)
                    : null;
            const to =
                typeof req.query.to === "string"
                    ? parseISODateToStartOfDay(req.query.to)
                    : null;

            if ((req.query.from && !from) || (req.query.to && !to)) {
                return this.badRequest(res, messages.GROWTH_LOG_INVALID_DATE);
            }

            const logs = await this.growthLogService.listForChild({
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
                message: messages.GROWTH_LOG_FETCH_SUCCESS,
                response: res,
            });
        } catch (error) {
            if (error instanceof ChildNotFoundError) {
                return this.notFound(res, messages.GROWTH_LOG_CHILD_NOT_FOUND);
            }
            return next(error);
        }
    };

    deleteGrowthLog = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { childId, measuredOn } = req.body;

            const parsedDate = parseISODateToStartOfDay(measuredOn);
            if (!parsedDate) {
                return this.badRequest(res, messages.GROWTH_LOG_INVALID_DATE);
            }

            // Removing a past day is the same act as editing it.
            if (parsedDate.getTime() !== getISTCalendarDate().getTime()) {
                return this.badRequest(res, messages.GROWTH_LOG_DAY_CLOSED);
            }

            const deleted = await this.growthLogService.deleteForDate({
                userId: req.user._id,
                childId,
                measuredOn: parsedDate,
            });

            if (!deleted) {
                return this.notFound(res, messages.GROWTH_LOG_NOT_FOUND);
            }

            return sendResponse({
                data: null,
                statusCode: StatusCodes.OK,
                success: true,
                message: messages.GROWTH_LOG_DELETED_SUCCESS,
                response: res,
            });
        } catch (error) {
            if (error instanceof ChildNotFoundError) {
                return this.notFound(res, messages.GROWTH_LOG_CHILD_NOT_FOUND);
            }
            return next(error);
        }
    };
}
