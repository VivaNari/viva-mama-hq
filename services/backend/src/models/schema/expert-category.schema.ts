import { Schema } from "mongoose";
import { generalSchemaOptions } from "../../constants/model";
import { EExpertCategory } from "../../types/expert.types";
import { IExpertCategory } from "../../types/expert-category.types";

const expertCategorySchema: Schema<IExpertCategory> = new Schema<IExpertCategory>(
    {
        // Stable machine key, mirrors the EExpertCategory enum. Migrations map an
        // expert's legacy string category to the row with the matching key.
        key: {
            type: String,
            enum: Object.values(EExpertCategory),
            required: true,
            unique: true,
        },
        name: {
            type: String,
            required: true,
        },
        description: {
            type: String,
            required: false,
            default: null,
        },
        // The concerns a category's experts typically handle. Rendered as the
        // "what this specialist helps with" list on the expert-picker screen.
        coveredAreas: {
            type: [String],
            default: [],
        },
        isActive: {
            type: Boolean,
            required: true,
            default: true,
        },
        // i18n bundles keyed by language code (e.g. "hi"). Holds only translatable
        // display strings; fields/keys missing here fall back to the base (English)
        // values. See utils/i18n/localizeExpertCategory.
        translations: { type: Schema.Types.Mixed, default: {} },
    },
    generalSchemaOptions,
);

export default expertCategorySchema;
