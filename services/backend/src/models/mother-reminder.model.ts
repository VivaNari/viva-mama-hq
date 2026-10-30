import mongoose, { Model } from "mongoose";
import { IMotherReminder } from "../types/reminder.types";
import motherReminderSchema from "./schema/mother-reminder.schema";

const motherReminderModel: Model<IMotherReminder> = mongoose.model<IMotherReminder>(
    "mother_reminders",
    motherReminderSchema,
);

export default motherReminderModel;
