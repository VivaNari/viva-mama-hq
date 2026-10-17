import { NextFunction, Request, Response } from "express";
import { StatusCodes } from "http-status-codes";

import { messages } from "../../../../constants/messages";
import {
    formatDateToISO,
    getISTCalendarDate,
    parseISODateToStartOfDay,
} from "../../../../services/date/date.service";
import MilestoneLogService, {
    ChildNotFoundError,
} from "../../../../services/milestone-log/milestone-log.service";
import { IMilestoneLog } from "../../../../types/milestone-log.types";
import sendResponse from "../../../../utils/commonFunctions/sendResponse";

export default class MilestoneLogController {
    private milestoneLogService: MilestoneLogService;

    constructor() {
        this.milestoneLogService = new MilestoneLogService();
    }

    /** `achievedOn` goes out as "YYYY-MM-DD", the shape the client sends it in. */
    private serialize = (entry: IMilestoneLog) => ({
        _id: entry._id,
        childId: entry.childId,
        milestoneKey: entry.milestoneKey,
        achievedOn: formatDateToISO(entry.achievedOn),
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

    achieveMilestone = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { childId, milestoneKey, achievedOn } = req.body;

            // Defaults to today. There is deliberately no closed-day rule here, unlike the
            // growth and diaper logs: a parent notices a milestone days after it first
            // happened, and dating it back is the normal case rather than a correction.
            const parsedDate = achievedOn
                ? parseISODateToStartOfDay(achievedOn)
                : getISTCalendarDate();

            if (!parsedDate) {
                return this.badRequest(res, messages.MILESTONE_LOG_INVALID_DATE);
            }

            if (parsedDate.getTime() > getISTCalendarDate().getTime()) {
                return this.badRequest(res, messages.MILESTONE_LOG_FUTURE_NOT_ALLOWED);
            }

            const child = await this.milestoneLogService.getOwnedChild(
                req.user._id,
                childId,
            );

            if (child.date_of_birth) {
                const birthDay = getISTCalendarDate(new Date(child.date_of_birth));
                if (parsedDate.getTime() < birthDay.getTime()) {
                    return this.badRequest(res, messages.MILESTONE_LOG_BEFORE_BIRTH);
                }
            }

            const entry = await this.milestoneLogService.achieve({
                userId: req.user._id,
                childId,
                milestoneKey,
                achievedOn: parsedDate,
            });

            return sendResponse({
                data: this.serialize(entry),
                statusCode: StatusCodes.OK,
                success: true,
                message: messages.MILESTONE_LOG_SAVED_SUCCESS,
                response: res,
            });
        } catch (error) {
            if (error instanceof ChildNotFoundError) {
                return this.notFound(res, messages.MILESTONE_LOG_CHILD_NOT_FOUND);
            }
            return next(error);
        }
    };

    getChildMilestones = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const childId = typeof req.query.childId === "string" ? req.query.childId : "";
            if (!childId) {
                return this.badRequest(res, messages.MILESTONE_LOG_CHILD_NOT_FOUND);
            }

            const logs = await this.milestoneLogService.listForChild(req.user._id, childId);

            return sendResponse({
                data: logs.map(this.serialize),
                totalCount: logs.length,
                statusCode: StatusCodes.OK,
                success: true,
                message: messages.MILESTONE_LOG_FETCH_SUCCESS,
                response: res,
            });
        } catch (error) {
            if (error instanceof ChildNotFoundError) {
                return this.notFound(res, messages.MILESTONE_LOG_CHILD_NOT_FOUND);
            }
            return next(error);
        }
    };

    forgetMilestone = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { childId, milestoneKey } = req.body;

            const removed = await this.milestoneLogService.forget({
                userId: req.user._id,
                childId,
                milestoneKey,
            });

            if (!removed) {
                return this.notFound(res, messages.MILESTONE_LOG_NOT_FOUND);
            }

            return sendResponse({
                data: { childId, milestoneKey },
                statusCode: StatusCodes.OK,
                success: true,
                message: messages.MILESTONE_LOG_DELETED_SUCCESS,
                response: res,
            });
        } catch (error) {
            if (error instanceof ChildNotFoundError) {
                return this.notFound(res, messages.MILESTONE_LOG_CHILD_NOT_FOUND);
            }
            return next(error);
        }
    };
}
