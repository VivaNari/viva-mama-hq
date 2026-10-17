import { Schema } from "mongoose";
import { IRecommendationHistory } from "../../types/recommendation-history.types";
import { required } from "joi";

export const RecommendationHistorySchema = new Schema<IRecommendationHistory>(
    {
        userId: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },
        week: { type: Number, required: true },
        finalScore: { type: Number, required: true },
        zone: {
            type: String,
            required: true,
            enum: ["RED", "YELLOW", "GREEN"],
        },
        breastfeeding: { type: Boolean, required: true },
        tagline: { type: String },
        individualRecommendations: {
            physical: {
                recommendation: {
                    title: { type: String, required: false },
                    goingWell: { type: String, required: false },
                    needsHelp: { type: String },
                    celebrate: { type: [String], default: [] },
                    tips: { type: [String], default: [] },
                    next: { type: [String], default: [] },
                },
                score: {
                    type: Number,
                    required: true,
                },
                zone: {
                    type: String,
                    required: true,
                    enum: ["RED", "YELLOW", "GREEN"],
                },
            },
            lactation: {
                recommendation: {
                    title: { type: String, required: true },
                    goingWell: { type: String, required: true },
                    needsHelp: { type: String },
                    celebrate: { type: [String], default: [] },
                    tips: { type: [String], default: [] },
                    next: { type: [String], default: [] },
                },
                score: {
                    type: Number,
                    required: true,
                },
                zone: {
                    type: String,
                    required: true,
                    enum: ["RED", "YELLOW", "GREEN"],
                },
            },
            emotional: {
                recommendation: {
                    title: { type: String, required: true },
                    goingWell: { type: String, required: true },
                    needsHelp: { type: String },
                    celebrate: { type: [String], default: [] },
                    tips: { type: [String], default: [] },
                    next: { type: [String], default: [] },
                },
                score: {
                    type: Number,
                    required: true,
                },
                zone: {
                    type: String,
                    required: true,
                    enum: ["RED", "YELLOW", "GREEN"],
                },
            },
        },
        categoryScores: {
            physical: {
                raw: { type: Number, required: true },
                weighted: { type: Number, required: true },
            },
            lactation: {
                raw: { type: Number, required: true },
                weighted: { type: Number, required: true },
            },
            emotional: {
                raw: { type: Number, required: true },
                weighted: { type: Number, required: true },
            },
        },
        checkinAnswersDump: [
            {
                question: { type: String, required: true },
                answer: { type: Schema.Types.Mixed, required: true },
            },
        ],
        // Per-language display text frozen at check-in time. Keyed by language
        // code ("en" | "hi"); read endpoints resolve the requested language.
        translations: {
            type: Schema.Types.Mixed,
            default: undefined,
        },
        // Which flow definition these answers were given against. Needed to turn
        // the emergency flags below back into display text at read time.
        flowDefId: {
            type: Schema.Types.ObjectId,
            ref: "flow_definitions",
            default: null,
        },
        // Clinically urgent answers from this check-in, as stable ids only — the
        // node id and the option `value`. The wording shown to the user comes
        // from the localized flow definition on read, so it follows her language
        // and any later copy edit. See constants/emergency-answers.ts.
        emergencyFlags: [
            {
                nodeId: { type: String, required: true },
                optionValue: { type: String, required: true },
                _id: false,
            },
        ],
        // Set when she dismisses the dashboard alert. Scoped to this row: next
        // week's check-in gets its own alert whatever she did with this one.
        alertDismissedAt: { type: Date, default: null },
    },
    { timestamps: true },
);

// Index for querying user history
RecommendationHistorySchema.index({ userId: 1, createdAt: -1 });

// One score per user per week. A check-in opens once a week and can be completed once, so
// a second row for the same week always means something ran twice — which is exactly what
// happened when the score pipeline was both published to Redis AND invoked inline. The
// gauge hid it (it reads the most recent row) but the progress graph plotted two points on
// the same week.
//
// Existing duplicates must be cleared before this can take effect: Mongo builds indexes in
// the background and a violation makes the build fail QUIETLY, leaving no constraint at all.
RecommendationHistorySchema.index({ userId: 1, week: 1 }, { unique: true });
