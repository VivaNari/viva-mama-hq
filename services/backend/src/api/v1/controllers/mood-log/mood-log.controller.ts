import { NextFunction, Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { messages } from "../../../../constants/messages";
import MoodLogService from "../../../../services/mood-log/mood-log.service";
import {
    formatDateToISO,
    getISTCalendarDate,
    parseISODateToStartOfDay,
} from "../../../../services/date/date.service";
import { IMoodLog } from "../../../../types/mood-log.types";
import sendResponse from "../../../../utils/commonFunctions/sendResponse";

export default class MoodLogController {
    private moodLogService: MoodLogService;
    constructor() {
        this.moodLogService = new MoodLogService();
    }

    // Serialize a stored mood log so logDate is returned as "YYYY-MM-DD".
    private serialize = (log: IMoodLog) => ({
        _id: log._id,
        userId: log.userId,
        mood: log.mood,
        logDate: formatDateToISO(log.logDate),
        createdAt: log.createdAt,
        updatedAt: log.updatedAt,
    });

    createOrUpdateMoodLog = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { mood, logDate } = req.body;

            const parsedDate = parseISODateToStartOfDay(logDate);
            if (!parsedDate) {
                return sendResponse({
                    data: null,
                    statusCode: StatusCodes.BAD_REQUEST,
                    success: false,
                    message: messages.MOOD_LOG_INVALID_DATE,
                    response: res,
                });
            }

            // Cannot log a mood for a future date.
            if (parsedDate.getTime() > getISTCalendarDate().getTime()) {
                return sendResponse({
                    data: null,
                    statusCode: StatusCodes.BAD_REQUEST,
                    success: false,
                    message: messages.MOOD_LOG_FUTURE_NOT_ALLOWED,
                    response: res,
                });
            }

            // Cannot backdate earlier than the day the user joined.
            const floor = await this.moodLogService.getBackdatingFloor(req.user._id);
            if (floor && parsedDate.getTime() < floor.getTime()) {
                return sendResponse({
                    data: null,
                    statusCode: StatusCodes.BAD_REQUEST,
                    success: false,
                    message: messages.MOOD_LOG_BEFORE_JOIN,
                    response: res,
                });
            }

            const moodLog = await this.moodLogService.upsertForDate({
                userId: req.user._id,
                mood,
                logDate: parsedDate,
            });

            sendResponse({
                data: moodLog ? this.serialize(moodLog as unknown as IMoodLog) : null,
                statusCode: StatusCodes.OK,
                success: true,
                message: messages.MOOD_LOG_SAVED_SUCCESS,
                response: res,
            });
        } catch (err) {
            console.log(err);
            next(err);
        }
    };

    getUserMoodLogs = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const filter: Record<string, any> = { userId: req.user._id };

            // Optional calendar-range filter: ?from=YYYY-MM-DD&to=YYYY-MM-DD
            const { from, to } = req.query;
            const dateRange: Record<string, Date> = {};
            if (typeof from === "string") {
                const parsedFrom = parseISODateToStartOfDay(from);
                if (parsedFrom) dateRange.$gte = parsedFrom;
            }
            if (typeof to === "string") {
                const parsedTo = parseISODateToStartOfDay(to);
                if (parsedTo) dateRange.$lte = parsedTo;
            }
            if (Object.keys(dateRange).length) {
                filter.logDate = dateRange;
            }

            const moodLogs = await this.moodLogService.find({
                filter,
                sort: { logDate: -1 },
            });

            sendResponse({
                data: moodLogs.map((log) => this.serialize(log)),
                totalCount: moodLogs.length,
                statusCode: StatusCodes.OK,
                success: true,
                message: messages.MOOD_LOG_FETCH_SUCCESS,
                response: res,
            });
        } catch (err) {
            console.log(err);
            next(err);
        }
    };

    deleteMoodLog = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const parsedDate = parseISODateToStartOfDay(req.body.logDate);
            if (!parsedDate) {
                return sendResponse({
                    data: null,
                    statusCode: StatusCodes.BAD_REQUEST,
                    success: false,
                    message: messages.MOOD_LOG_INVALID_DATE,
                    response: res,
                });
            }

            const result = await this.moodLogService.delete({
                filter: {
                    userId: req.user._id,
                    logDate: parsedDate,
                },
            });

            if (!result.deletedCount) {
                return sendResponse({
                    data: null,
                    statusCode: StatusCodes.NOT_FOUND,
                    success: false,
                    message: messages.MOOD_LOG_NOT_FOUND,
                    response: res,
                });
            }

            sendResponse({
                data: result,
                statusCode: StatusCodes.OK,
                success: true,
                message: messages.MOOD_LOG_DELETED_SUCCESS,
                response: res,
            });
        } catch (err) {
            console.log(err);
            next(err);
        }
    };
}
