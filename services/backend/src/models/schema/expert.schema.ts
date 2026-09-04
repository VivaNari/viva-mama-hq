import { Schema } from "mongoose";
import { generalSchemaOptions } from "../../constants/model";
import { IExpert } from "../../types/expert.types";

const expertSchema: Schema<IExpert> = new Schema<IExpert>(
    {
        name: {
            type: String,
            required: true,
        },
        speciality: {
            type: String,
            required: true,
        },
        category: {
            type: Schema.Types.ObjectId,
            ref: "expert_categories",
            required: true,
        },
        // LEGACY, and no longer part of any live code path.
        //
        // Codes used to live here. They now live in `referral_programs`, because a code
        // carries a plan and a seat pool that an expert document has nowhere to put.
        // Nothing reads this field to resolve a redemption any more — the one endpoint
        // that did (POST /user/map-expert-referral) is gone, and no new codes are
        // written here either, since add-expert-referral-codes is unregistered.
        //
        // It survives for exactly one reason: seed-referral-programs-from-experts reads
        // it to import the codes already in the database into programs. Once that has
        // run in production and the programs are verified, the field and that step can
        // both be deleted.
        //
        // `unique` was removed deliberately: a sparse index still indexes an explicit
        // null, and this field defaults to null, so the second expert created without a
        // code threw E11000. Dropping it here does NOT drop the index that is already
        // built — mongoose creates indexes but never removes them. See the
        // drop-expert-referral-code-index migration step.
        referralCode: {
            type: String,
            default: null,
        },
        qualification: {
            type: String,
            required: false,
            default: null,
        },
        yearsOfExperience: {
            type: Number,
            required: true,
        },
        bio: {
            type: String,
            required: false,
            default: null,
        },
        photograph: {
            type: String,
            required: true,
        },
        remuneration: {
            type: Number,
            required: true,
        },
        // See IExpert.is_empanelled_expert — credits are spendable only on the panel.
        // Defaults to false so an expert added without thinking about it is off-panel.
        is_empanelled_expert: {
            type: Boolean,
            required: true,
            default: false,
        },
        isActive: {
            type: Boolean,
            required: true,
            default: true,
        },
        // Booking-notification recipient. See IExpert.contactWhatsappNumber — null falls
        // back to the coordinator constant so a newly seeded expert is never unreachable.
        contactWhatsappNumber: {
            type: String,
            required: false,
            default: null,
        },
        // i18n bundles keyed by language code (e.g. "hi"). Holds only
        // translatable display strings; fields/keys missing here fall back to
        // the base (English) values. See utils/i18n/localizeExpert.
        translations: { type: Schema.Types.Mixed, default: {} },
    },
    generalSchemaOptions,
);

export default expertSchema;
