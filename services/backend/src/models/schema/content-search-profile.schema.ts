import { Schema } from "mongoose";

import { generalSchemaOptions } from "../../constants/model";
import { EUserCategory } from "../../types";
import {
    EContentProfileStatus,
    IContentSearchProfile,
} from "../../types/content-search-profile.types";

/**
 * How the chatbot finds a content item. A collection of its own because GET /contents
 * returns whole content documents, and none of this belongs in the app.
 */
const contentSearchProfileSchema = new Schema<IContentSearchProfile>(
    {
        contentId: {
            type: Schema.Types.ObjectId,
            ref: "contents",
            required: true,
            unique: true,
        },
        status: {
            type: String,
            enum: Object.values(EContentProfileStatus),
            required: true,
        },
        summary: { type: String, default: "" },
        oneLiner: { type: String, default: "" },
        keywordsEn: { type: [String], default: [] },
        keywordsHi: { type: [String], default: [] },
        exampleQuestions: {
            type: [
                {
                    _id: false,
                    text: { type: String, required: true },
                    language: { type: String, enum: ["en", "hi", "hinglish"], required: true },
                    timestamp: { type: String, default: null },
                },
            ],
            default: [],
        },
        suitableFor: {
            type: [{ type: String, enum: Object.values(EUserCategory) }],
            default: [],
        },
        sourceHash: { type: String, required: true },
        videoChecked: { type: Boolean, default: false },
        revision: { type: Number, default: 1 },
        approvedAt: { type: Date, default: null },
        approvedBy: { type: Schema.Types.ObjectId, ref: "users", default: null },
    },
    generalSchemaOptions,
);

export default contentSearchProfileSchema;
