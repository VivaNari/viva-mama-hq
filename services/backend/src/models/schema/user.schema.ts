import mongoose, { Schema, model, Document } from "mongoose";
import { ESex, IChild, IUser } from "../../types";
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
        email: {
            type: String,
            unique: true,
            lowercase: true,
            trim: true,
        },
        mobile_number: {
            type: String,
        },
        country_code: {
            type: String,
        },
        profile_picture: {
            type: String,
        },
        is_onboarded: {
            type: Boolean,
            default: false,
        },
        user_name: {
            type: String,
        },
        date_of_birth: {
            type: Date,
        },
        height: {
            type: Number,
        },
        childs: [childSchema],
        partner_referral_code: {
            type: String,
        },
        referral_code: {
            type: String,
            unique: true,
            sparse: true,
        },
        referred_user_id: {
            type: Number,
        },
        referred_user_object_id: {
            type: Schema.Types.ObjectId,
            ref: "users",
        },
        FCM_token: {
            type: String,
        },
        current_postpartum_week: {
            type: Number,
        },
        date_of_delivery: {
            type: Date,
        },
        is_breastfeeding_currently: Boolean,
        onboarding_data: {
            preferred_name: { type: String },
            date_of_birth: { type: Date },
            location: { type: String },
            conception_method: { type: String },
            pregnancy_conditions: [{ type: String }],
            delivery_date: { type: Date },
            delivery_type: { type: String },
            delivery_outcome: { type: String },
            past_medications: [{ type: String }],
            current_medications: [{ type: String }],
            tobacco_use: { type: String },
            alcohol_use: { type: String },
            social_support: { type: String },
            parity: { type: String },
            onboarded_at: { type: Date },
        },
    },
    {
        timestamps: true,
    },
);

userSchema.plugin(AutoIncrement, { inc_field: "user_id" });

export default userSchema;
