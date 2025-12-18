import { Schema } from "mongoose";
import { ContentBodyTypeEnum, IContent } from "../../types/content.types";
import { EUserCategory } from "../../types";

const contentSchema = new Schema<IContent>({
    featuredImage: {
        type: String,
        default: null,
        required: true,
    },
    featuredTitle: {
        type: String,
        default: null,
        required: true,
    },
    category: {
        type: String,
        enum: Object.values(EUserCategory),
        required: true,
        default: null,
    },
    validWeeks: [
        {
            type: Number,
            required: true,
        },
    ],
    contentBody: [
        {
            contentType: {
                type: String,
                enum: Object.values(ContentBodyTypeEnum),
                required: true,
                default: null,
            },
            body: {
                type: String,
                required: true,
            },
        },
    ],
});

export default contentSchema;
