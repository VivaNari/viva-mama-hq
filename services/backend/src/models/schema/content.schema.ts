import { Schema } from "mongoose";
import { ContentBodyTypeEnum, EContentGroup, IContent } from "../../types/content.types";
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
        // The enum sits on the element type, not the array — mongoose only allows
        // `enum` where the path's type is a string.
        type: [{ type: String, enum: Object.values(EUserCategory) }],
        // On an array path mongoose's `required` check is `value.length > 0`, so this
        // already rejects the empty array. That matters: [] matches no user at all, and
        // would silently produce an article nobody can ever see.
        required: true,
        validate: {
            validator: (value: EUserCategory[]) => Array.isArray(value) && value.length > 0,
            message: "category must contain at least one user category",
        },
    },
    contentGroup: {
        type: String,
        // null is a valid, meaningful state: "not yet classified". required would
        // block that, and the enum must admit null explicitly.
        enum: [...Object.values(EContentGroup), null],
        default: null,
    },
    sortOrder: {
        type: Number,
        default: 0,
    },
    isFreeOverride: {
        type: Boolean,
        default: false,
    },
    validWeekStart: {
        type: Number,
        required: true,
    },
    validWeekEnd: {
        type: Number,
        required: true,
    },
    authors: {
        type: [Schema.Types.ObjectId],
        ref: "experts",
        required: false,
        default: [],
    },
    reviewers: {
        type: [Schema.Types.ObjectId],
        ref: "experts",
        required: false,
        default: [],
    },
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
    // i18n bundles keyed by language code (e.g. "hi"). Holds only translatable
    // display content; fields missing here fall back to the base (English)
    // values. See utils/i18n/localizeContent.
    translations: { type: Schema.Types.Mixed, default: {} },
});

// Matches the tier-gated read in ContentController.getContents: category membership,
// then group, then the week window, ordered by the free-slice tiebreaker.
contentSchema.index({ category: 1, contentGroup: 1, validWeekStart: 1, validWeekEnd: 1 });
contentSchema.index({ sortOrder: 1, _id: 1 });

export default contentSchema;
