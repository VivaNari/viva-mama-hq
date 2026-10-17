import { Document } from "mongoose";
import { EExpertCategory } from "./expert.types";
import { FlowLanguage } from "./chat.types";

/**
 * Translatable display fields of an expert category for one non-default language.
 * Any field may be omitted; the base (English) value is the fallback.
 */
export interface IExpertCategoryTranslationBundle {
    name?: string;
    description?: string;
    coveredAreas?: string[];
}

export type IExpertCategoryTranslations = Partial<
    Record<FlowLanguage, IExpertCategoryTranslationBundle>
>;

/**
 * An expert category (Nutritionist, Gynaecologist, …). Experts reference one of
 * these by ObjectId via `expert.category`. Alongside the display name it carries
 * `coveredAreas` — the concerns a category's experts typically handle, shown as
 * the "what this specialist helps with" list on the expert-picker screen.
 */
export interface IExpertCategory extends Document {
    /** Stable machine key, one of EExpertCategory. Unique across the collection. */
    key: EExpertCategory;
    /** Display name, e.g. "Nutritionist". */
    name: string;
    /** One-line subtitle describing when to pick this category. */
    description: string;
    /** Concerns this category's experts usually cover. */
    coveredAreas: string[];
    isActive: boolean;
    // i18n bundles keyed by language code (e.g. "hi"). Holds only translatable
    // display strings; fields missing here fall back to the base (English) values.
    translations?: IExpertCategoryTranslations;
}
