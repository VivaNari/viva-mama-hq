import mongoose, { Schema } from "mongoose";
import { ESex, EUserCategory, IChild, IUser, TUsercategory } from "../../types";
const AutoIncrement = require("mongoose-sequence")(mongoose);

const childSchema = new Schema<IChild>(
    {
        child_id: {
            type: Number,
        },
        name: {
            type: String,
            required: true,
        },
        date_of_birth: {
            type: Date,
            required: true,
        },
        sex: {
            type: String,
            enum: [ESex.MALE, ESex.FEMALE, ESex.OTHER],
        },
    },
    {
        timestamps: true,
    },
);

const userSchema = new Schema<IUser>(
    {
        user_id: {
            type: Number,
        },
        user_category: {
            type: String,
            default: null,
            enum: Object.values(EUserCategory),
        },
        email: {
            type: String,
            unique: true,
            lowercase: true,
            trim: true,
            default: null,
        },
        mobile_number: {
            type: String,
            default: null,
        },
        country_code: {
            type: String,
            default: null,
        },
        profile_picture: {
            type: String,
            default: null,
        },
        is_onboarded: {
            is_questionnaire_completed: {
                type: Boolean,
                default: false,
            },
            is_subscription_completed: {
                type: Boolean,
                default: false,
            },
        },
        childs: {
            type: [childSchema],
            default: [],
        },
        partner_referral_code: {
            type: String,
            default: null,
        },
        referral_code: {
            type: String,
            unique: true,
            sparse: true,
        },
        referred_user_id: {
            type: Number,
            default: null,
        },
        referred_user_object_id: {
            type: Schema.Types.ObjectId,
            ref: "users",
            default: null,
        },
        FCM_token: {
            type: String,
        },
        current_weekdays: {
            weeks: {
                type: Number,
                default: null,
            },
            days: {
                type: Number,
                default: null,
            },
        },
        previous_weekly_checkin_due_days: {
            type: Number,
            default: 0,
        },
        upcoming_weekly_checkin_due_days: {
            type: Number,
            default: 0,
        },
        is_breastfeeding_currently: Boolean,
        onboarding_data: {
            preferred_name: {
                type: String,
                default: null,
            },
            date_of_birth: {
                type: Date,
                default: null,
            },
            location: {
                type: String,
                default: null,
            },
            conception_method: {
                type: String,
                default: null,
            },
            pregnancy_conditions: {
                type: [String],
                default: [],
            },
            is_not_pragnant_yet: {
                type: Boolean,
                default: null,
            },
            delivery_date: {
                type: Date,
                default: null,
            },
            delivery_type: {
                type: String,
                default: null,
            },
            delivery_outcome: {
                type: String,
                default: null,
            },
            past_medications: {
                type: [String],
                default: [],
            },
            current_medications: {
                type: [String],
                default: [],
            },
            tobacco_use: {
                type: String,
                default: null,
            },
            alcohol_use: {
                type: String,
                default: null,
            },
            social_support: {
                type: String,
                default: null,
            },
            parity: {
                type: String,
                default: null,
            },
            onboarded_at: {
                type: Date,
                default: null,
            },
        },
        subscription: {
            plan: {
                type: String,
                default: null,
            },
            status: {
                type: String,
                default: null,
            },
            billingCycle: {
                type: String,
                default: null,
            },
            expiryDate: {
                type: Date,
                default: null,
            },
        },
    },
    {
        timestamps: true,
    },
);

userSchema.plugin(AutoIncrement, { inc_field: "user_id" });

export default userSchema;
