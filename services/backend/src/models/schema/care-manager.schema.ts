import { Schema } from "mongoose";
import { ICareManager } from "../../types/care-manager.types";
import { CARE_MANAGER_DEFAULT_REMUNERATION } from "../../constants/care-manager";

const careManagerSchema = new Schema<ICareManager>({
    name: { type: String, required: true },
    email: { type: String, required: true },
    phoneNumber: { type: String, required: true },
    // Booking-notification recipient, separate from the care manager's own phoneNumber.
    // See ICareManager.contactWhatsappNumber.
    contactWhatsappNumber: { type: String, required: false, default: null },
    // Pay-per-session fee in rupees. See ICareManager.remuneration — defaulted rather
    // than required so an existing document that predates the field still loads, and the
    // backfill migration sets the real value.
    remuneration: {
        type: Number,
        required: false,
        default: CARE_MANAGER_DEFAULT_REMUNERATION,
    },
    imageUrl: { type: String, required: false },
    // Per-language display fields (e.g. localized name). Stripped on read.
    translations: { type: Schema.Types.Mixed, default: {} },
});

export default careManagerSchema;
