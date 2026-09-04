import mongoose, { Schema } from "mongoose";
import { ESex, EUserCategory, EUserRole, IChild, IUser, TUsercategory } from "../../types";
import { FlowLanguageEnum } from "../../types/chat.types";
import {
    EBillingMode,
    EPlanCode,
    ESubscriptionStatus,
    ESubscriptionTier,
} from "../../types/subscription.types";
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
        role: {
            type: String,
            enum: Object.values(EUserRole),
            default: EUserRole.USER,
            index: true,
        },
        // bcrypt hash, staff accounts only — administrators sign in with their email.
        // `select: false` keeps it out of every read that doesn't ask for it by name,
        // including BaseService.find and the admin listing endpoint.
        password: {
            type: String,
            default: null,
            select: false,
        },
        email: {
            type: String,
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
        expert_referral_code: {
            type: String,
            default: null,
        },
        referred_by_expert_id: {
            type: Schema.Types.ObjectId,
            ref: "experts",
            default: null,
        },
        referred_by_organization_id: {
            type: Schema.Types.ObjectId,
            ref: "organizations",
            default: null,
        },
        referral_program_id: {
            type: Schema.Types.ObjectId,
            ref: "referral_programs",
            default: null,
        },
        // Per-user narrowings of the tier matrix, copied here from the referral program
        // at redemption. Denormalized so the entitlement hot path stays one user read —
        // resolveFor already loads this document, and joining a program on every
        // capability check would put a second query in front of every gated request.
        //
        // Narrowing only: see resolveRule in entitlement.config.ts for why an override
        // can never widen access.
        entitlement_overrides: {
            type: [
                {
                    _id: false,
                    capability: { type: String, required: true },
                    access: { type: String, required: true },
                },
            ],
            default: [],
        },
        FCM_token: {
            type: String,
        },
        preferred_language: {
            type: String,
            enum: Object.values(FlowLanguageEnum),
            default: FlowLanguageEnum.EN,
        },
        current_weekdays: {
            weeks: {
                type: Number,
                default: 1,
            },
            days: {
                type: Number,
                default: null,
            },
            upcoming_checkin_due_days: {
                type: Number,
                default: 0,
            },
            previous_checkin_due_days: {
                type: Number,
                default: 0,
            },
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
            // Asked of postpartum mothers only, so null is a normal value here — it
            // means "never asked", not "no answer". See IUser.onboarding_data.
            feeding_method: {
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
        // Denormalized read snapshot of the user's current `subscriptions` row, so the
        // hot path never joins. SubscriptionService is the only writer. Not the source
        // of truth — EntitlementService.resolveTier re-derives the tier from the dates,
        // so a stale snapshot can never grant access the user no longer has.
        subscription: {
            tier: {
                type: String,
                enum: Object.values(ESubscriptionTier),
                default: ESubscriptionTier.FREE,
            },
            status: {
                type: String,
                enum: [...Object.values(ESubscriptionStatus), null],
                default: null,
            },
            planCode: {
                type: String,
                enum: [...Object.values(EPlanCode), null],
                default: null,
            },
            subscription_id: {
                type: Schema.Types.ObjectId,
                ref: "subscriptions",
                default: null,
            },
            billingMode: {
                type: String,
                enum: [...Object.values(EBillingMode), null],
                default: null,
            },
            trialEndAt: {
                type: Date,
                default: null,
            },
            currentPeriodEnd: {
                type: Date,
                default: null,
            },
            // A trial is once per user, forever. Never reset — not on expiry, not on
            // cancellation, not on re-subscribe.
            hasUsedTrial: {
                type: Boolean,
                default: false,
            },
        },
        // Who this user has blocked in Viva Club. Filtering is one-directional in intent
        // but applied both ways on read: a blocked user must also stop seeing the
        // blocker, or blocking someone who is harassing you just hides the evidence
        // from you while leaving them a clear view.
        blockedUsers: {
            type: [{ type: Schema.Types.ObjectId, ref: "users" }],
            default: [],
        },
        // Set by a reviewer from the moderation queue. Bars posting and commenting and
        // nothing else — a banned user keeps their check-ins, consultations and chat,
        // because those are health services, not a community privilege.
        communityBanned: {
            type: Boolean,
            default: false,
        },
        consents: {
            type: [
                {
                    type: {
                        type: String,
                        enum: ["privacy_policy", "terms_of_use", "community_guidelines"],
                    },
                    version: String,
                    acceptedAt: {
                        type: Date,
                        default: Date.now,
                    },
                },
            ],
            default: [],
        },
    },
    {
        timestamps: true,
    },
);

// One administrator per email address. Partial rather than plain-unique, and scoped to
// the SUPER_ADMIN role: patients share the `email` field, many of them sit on null, and
// a unique index across all of them would reject the second such signup outright.
userSchema.index(
    { email: 1 },
    { unique: true, partialFilterExpression: { role: EUserRole.SUPER_ADMIN } },
);

userSchema.plugin(AutoIncrement, { inc_field: "user_id" });

export default userSchema;
