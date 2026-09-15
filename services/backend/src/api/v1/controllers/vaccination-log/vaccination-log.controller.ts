import { NextFunction, Request, Response } from "express";
import { StatusCodes } from "http-status-codes";

import { messages } from "../../../../constants/messages";
import {
    formatDateToISO,
    getISTCalendarDate,
    parseISODateToStartOfDay,
} from "../../../../services/date/date.service";
import VaccinationLogService, {
    ChildNotFoundError,
} from "../../../../services/vaccination-log/vaccination-log.service";
import { IVaccinationLog } from "../../../../types/vaccination-log.types";
import sendResponse from "../../../../utils/commonFunctions/sendResponse";

export default class VaccinationLogController {
    private vaccinationLogService: VaccinationLogService;

    constructor() {
        this.vaccinationLogService = new VaccinationLogService();
    }

    /** `givenOn` goes out as "YYYY-MM-DD", the shape the client sends it in. */
    private serialize = (entry: IVaccinationLog) => ({
        _id: entry._id,
        childId: entry.childId,
        vaccineKey: entry.vaccineKey,
        givenOn: formatDateToISO(entry.givenOn),
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

    recordDose = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { childId, vaccineKey, givenOn } = req.body;

            // Defaults to today. There is deliberately no closed-day rule here, unlike the
            // growth and diaper logs: a parent copies a clinic card in one sitting, and
            // most of what they enter happened weeks ago.
            const parsedDate = givenOn
                ? parseISODateToStartOfDay(givenOn)
                : getISTCalendarDate();

            if (!parsedDate) {
                return this.badRequest(res, messages.VACCINATION_LOG_INVALID_DATE);
            }

            if (parsedDate.getTime() > getISTCalendarDate().getTime()) {
                return this.badRequest(res, messages.VACCINATION_LOG_FUTURE_NOT_ALLOWED);
            }

            const child = await this.vaccinationLogService.getOwnedChild(
                req.user._id,
                childId,
            );

            // The birth dose is given within 24 hours of delivery, so the birthday itself
            // is a valid date — the bound is inclusive.
            if (child.date_of_birth) {
                const birthDay = getISTCalendarDate(new Date(child.date_of_birth));
                if (parsedDate.getTime() < birthDay.getTime()) {
                    return this.badRequest(res, messages.VACCINATION_LOG_BEFORE_BIRTH);
                }
            }

            const entry = await this.vaccinationLogService.record({
                userId: req.user._id,
                childId,
                vaccineKey,
                givenOn: parsedDate,
            });

            return sendResponse({
                data: this.serialize(entry),
                statusCode: StatusCodes.OK,
                success: true,
                message: messages.VACCINATION_LOG_SAVED_SUCCESS,
                response: res,
            });
        } catch (error) {
            if (error instanceof ChildNotFoundError) {
                return this.notFound(res, messages.VACCINATION_LOG_CHILD_NOT_FOUND);
            }
            return next(error);
        }
    };

    getChildVaccinations = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const childId = typeof req.query.childId === "string" ? req.query.childId : "";
            if (!childId) {
                return this.badRequest(res, messages.VACCINATION_LOG_CHILD_NOT_FOUND);
            }

            const logs = await this.vaccinationLogService.listForChild(
                req.user._id,
                childId,
            );

            return sendResponse({
                data: logs.map(this.serialize),
                totalCount: logs.length,
                statusCode: StatusCodes.OK,
                success: true,
                message: messages.VACCINATION_LOG_FETCH_SUCCESS,
                response: res,
            });
        } catch (error) {
            if (error instanceof ChildNotFoundError) {
                return this.notFound(res, messages.VACCINATION_LOG_CHILD_NOT_FOUND);
            }
            return next(error);
        }
    };

    removeDose = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { childId, vaccineKey } = req.body;

            const removed = await this.vaccinationLogService.remove({
                userId: req.user._id,
                childId,
                vaccineKey,
            });

            if (!removed) {
                return this.notFound(res, messages.VACCINATION_LOG_NOT_FOUND);
            }

            return sendResponse({
                data: { childId, vaccineKey },
                statusCode: StatusCodes.OK,
                success: true,
                message: messages.VACCINATION_LOG_DELETED_SUCCESS,
                response: res,
            });
        } catch (error) {
            if (error instanceof ChildNotFoundError) {
                return this.notFound(res, messages.VACCINATION_LOG_CHILD_NOT_FOUND);
            }
            return next(error);
        }
    };
}
