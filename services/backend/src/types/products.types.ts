import { Schema } from "mongoose";
import { FlowLanguage } from "./chat.types";
import { EUserCategory } from "./user.types";

/**
 * Translatable display fields of a product for one non-default language.
 * Any field may be omitted; the base (English) value is the fallback.
 */
export interface IProductTranslationBundle {
    productName?: string;
    productDescription?: string;
    productCategory?: string;
    productPriceRange?: string;
    safetyFlag?: string;
}

export type IProductTranslations = Partial<Record<FlowLanguage, IProductTranslationBundle>>;

export interface IProduct {
    _id: Schema.Types.ObjectId;
    productImageURL: string;
    productName: string;
    /** Stripped from the payload on locked products — shipping the link would defeat the blur. */
    productAffiliateLink: string;
    /** Array for the same reason as `IContent.category`; query sites are unaffected. */
    userCategory: EUserCategory[];
    /**
     * Required for a stable free slice. "First 2 unlocked" needs a deterministic
     * ordering — Mongo's natural order changes on document rewrite, which would make
     * the unlocked products silently shuffle between two loads of the same screen.
     */
    sortOrder: number;
    validWeekStart: number;
    validWeekEnd: number;
    productCategory: string;
    productDescription: string;
    productPriceRange: string;
    safetyFlag: string;
    translations?: IProductTranslations;
    /** Set on gated list/detail responses. Never persisted. */
    isLocked?: boolean;
}
