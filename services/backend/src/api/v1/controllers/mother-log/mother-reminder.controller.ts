import { NextFunction, Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { isValidObjectId } from "mongoose";

import { messages } from "../../../../constants/messages";
import ReminderService, {
    ICreateReminderInput,
} from "../../../../services/reminders/reminder.service";
import { IMotherReminder } from "../../../../types/reminder.types";
import sendResponse from "../../../../utils/commonFunctions/sendResponse";

/**
 * Her reminders from the Viva AI Reminders screen. Nothing is seeded: the list holds
 * only what she set. The custom-reminders job sends them as push notifications.
 */
export default class MotherReminderController {
    private service: ReminderService;

    constructor() {
        this.service = new ReminderService();
    }

    private serialize = (reminder: IMotherReminder) => ({
        _id: reminder._id,
        category: reminder.category,
        detail: reminder.detail,
        timeOfDay: reminder.timeOfDay,
        frequency: reminder.frequency,
        weekdays: reminder.weekdays,
        startDate: reminder.startDate,
        endDate: reminder.endDate,
        careModel: reminder.careModel,
    });

    getReminders = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const reminders = await this.service.list(req.user._id);
            sendResponse({
                data: { reminders: reminders.map(this.serialize) },
                statusCode: StatusCodes.OK,
                success: true,
                message: messages.REMINDER_FETCH_SUCCESS,
                response: res,
            });
        } catch (err) {
            next(err);
        }
    };

    createReminder = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const reminder = await this.service.create(
                req.user._id,
                req.body as ICreateReminderInput,
            );
            if (!reminder) {
                return sendResponse({
                    data: null,
                    statusCode: StatusCodes.BAD_REQUEST,
                    success: false,
                    message: messages.REMINDER_LIMIT_REACHED,
                    response: res,
                });
            }

            sendResponse({
                data: this.serialize(reminder),
                statusCode: StatusCodes.CREATED,
                success: true,
                message: messages.REMINDER_SAVED_SUCCESS,
                response: res,
            });
        } catch (err) {
            next(err);
        }
    };

    deleteReminder = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const id = req.params.id as string;
            if (!isValidObjectId(id)) {
                return sendResponse({
                    data: null,
                    statusCode: StatusCodes.BAD_REQUEST,
                    success: false,
                    message: messages.MOTHER_LOG_INVALID_ID,
                    response: res,
                });
            }

            if (!(await this.service.remove(req.user._id, id))) {
                return sendResponse({
                    data: null,
                    statusCode: StatusCodes.NOT_FOUND,
                    success: false,
                    message: messages.REMINDER_NOT_FOUND,
                    response: res,
                });
            }

            sendResponse({
                data: null,
                statusCode: StatusCodes.OK,
                success: true,
                message: messages.REMINDER_DELETED_SUCCESS,
                response: res,
            });
        } catch (err) {
            next(err);
        }
    };
}
