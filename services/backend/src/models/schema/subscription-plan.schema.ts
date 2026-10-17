import { Schema } from "mongoose";
import { generalSchemaOptions } from "../../constants/model";
import { EPlanCode, ISubscriptionPlan } from "../../types/subscription.types";

/**
 * The plan catalog. Deliberately a collection rather than a constant: prices and
 * credit counts must be changeable without an app-store release, and the app renders
 * this list straight from GET /subscription/plans.
 */
const subscriptionPlanSchema = new Schema<ISubscriptionPlan>(
    {
        code: {
            type: String,
            enum: Object.values(EPlanCode),
            required: true,
            unique: true,
        },
        displayName: { type: String, required: true },
        description: { type: String, default: null },
        // Paise, not rupees — currency as an integer everywhere so no float rounding
        // can ever reach a payment gateway. Razorpay's API is paise-denominated too.
        amountPaise: { type: Number, required: true, min: 0 },
        durationDays: { type: Number, required: true, min: 1 },
        credits: {
            expert: { type: Number, required: true, min: 0 },
            careManager: { type: Number, required: true, min: 0 },
        },
        razorpayPlanId: { type: String, default: null },
        // PLAY only. Maps a Play Console product + base plan back to this plan. Seeded
        // from PLAY_PRODUCTS; see services/subscription/billing/play-products.ts for why
        // the values live in one file.
        playProductId: { type: String, default: null },
        playBasePlanId: { type: String, default: null },
        isActive: { type: Boolean, default: true },
        sortOrder: { type: Number, default: 0 },
        // i18n bundles keyed by language code, following the same convention as
        // contents/products. See utils/i18n.
        translations: { type: Schema.Types.Mixed, default: {} },
    },
    generalSchemaOptions,
);

subscriptionPlanSchema.index({ isActive: 1, sortOrder: 1 });

export default subscriptionPlanSchema;
