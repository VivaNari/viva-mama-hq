import { NextFunction, Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { isValidObjectId, Types } from "mongoose";

import { messages } from "../../../../constants/messages";
import MotherLogService from "../../../../services/mother-log/mother-log.service";
import {
    IMotherMedicine,
    TLogSource,
    TMedicineFrequency,
    TMedicinePreset,
} from "../../../../types/mother-log.types";
import sendResponse from "../../../../utils/commonFunctions/sendResponse";

/**
 * Her medicines and supplements, and which were taken today.
 *
 * The list is hers alone: nothing is seeded. Marking a medicine taken writes a
 * `medicine_dose` log for today, at most one per medicine per day.
 */
export default class MotherMedicineController {
    private service: MotherLogService;

    constructor() {
        this.service = new MotherLogService();
    }

    private serialize = (medicine: IMotherMedicine, takenToday: boolean) => ({
        _id: medicine._id,
        presetKey: medicine.presetKey,
        name: medicine.name,
        frequency: medicine.frequency,
        takenToday,
    });

    /** The list, today's taken state, and the iron-folic acid week strip. */
    private snapshot = async (userId: string) => {
        const medicines = (await this.service.listMedicines(userId)) as IMotherMedicine[];
        const [taken, ifaWeek] = await Promise.all([
            this.service.takenToday(
                userId,
                medicines.map((medicine) => medicine._id as unknown as Types.ObjectId),
            ),
            this.service.ifaWeek(userId, medicines),
        ]);

        return {
            medicines: medicines.map((medicine) =>
                this.serialize(medicine, taken.has(String(medicine._id))),
            ),
            hasIfa: medicines.some((medicine) => medicine.presetKey === "iron_folic_acid"),
            ifaWeek,
        };
    };

    getMedicines = async (req: Request, res: Response, next: NextFunction) => {
        try {
            sendResponse({
                data: await this.snapshot(req.user._id),
                statusCode: StatusCodes.OK,
                success: true,
                message: messages.MOTHER_MEDICINE_FETCH_SUCCESS,
                response: res,
            });
        } catch (err) {
            next(err);
        }
    };

    addMedicine = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { presetKey, name, frequency } = req.body as {
                presetKey?: TMedicinePreset;
                name?: string;
                frequency: TMedicineFrequency;
            };

            await this.service.addMedicine({
                userId: req.user._id,
                presetKey: presetKey ?? null,
                name: presetKey ? null : (name ?? "").trim(),
                frequency,
            });

            sendResponse({
                data: await this.snapshot(req.user._id),
                statusCode: StatusCodes.OK,
                success: true,
                message: messages.MOTHER_MEDICINE_SAVED_SUCCESS,
                response: res,
            });
        } catch (err) {
            next(err);
        }
    };

    setTaken = async (req: Request, res: Response, next: NextFunction) => {
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

            const medicine = await this.service.findOwnMedicine(req.user._id, id);
            if (!medicine) {
                return sendResponse({
                    data: null,
                    statusCode: StatusCodes.NOT_FOUND,
                    success: false,
                    message: messages.MOTHER_MEDICINE_NOT_FOUND,
                    response: res,
                });
            }

            const { taken, source } = req.body as { taken: boolean; source?: TLogSource };
            const context = await this.service.getContext(req.user._id);
            await this.service.setDoseTaken({
                userId: req.user._id,
                medicineId: medicine._id as unknown as Types.ObjectId,
                taken,
                source: source ?? "manual",
                context,
            });

            sendResponse({
                data: await this.snapshot(req.user._id),
                statusCode: StatusCodes.OK,
                success: true,
                message: messages.MOTHER_MEDICINE_SAVED_SUCCESS,
                response: res,
            });
        } catch (err) {
            next(err);
        }
    };
}
