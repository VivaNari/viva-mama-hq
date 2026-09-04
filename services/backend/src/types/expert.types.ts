import { Document, Types } from "mongoose";
import { FlowLanguage } from "./chat.types";

/**
 * Stable machine keys for expert categories. These are no longer stored directly
 * on the expert; they identify the row in the `expert_categories` collection that
 * an expert's `category` ObjectId points at (see IExpertCategory). Kept as an enum
 * so the seed and the string-to-ObjectId migration share one source of truth.
 */
export enum EExpertCategory {
    NUTRITIONIST = "NUTRITIONIST",
    LACTATION_CONSULTANT = "LACTATION_CONSULTANT",
    GYNECOLOGIST = "GYNECOLOGIST",
    PEDIATRICIAN = "PEDIATRICIAN",
    PSYCHOLOGIST = "PSYCHOLOGIST",
    COUNSELLING_PSYCHOLOGIST = "COUNSELLING_PSYCHOLOGIST",
    PSYCHIATRIST = "PSYCHIATRIST",
    GENERAL_PHYSICIAN = "GENERAL_PHYSICIAN",
}

/**
 * Translatable display fields of an expert for one non-default language.
 * Any field may be omitted; the base (English) value is the fallback.
 */
export interface IExpertTranslationBundle {
    name?: string;
    speciality?: string;
    qualification?: string;
    bio?: string;
}

export type IExpertTranslations = Partial<Record<FlowLanguage, IExpertTranslationBundle>>;

export interface IExpert extends Document {
    name: string;
    speciality: string;
    // Reference to an `expert_categories` document. Previously an EExpertCategory
    // string enum stored inline; migrated to an ObjectId ref so category metadata
    // (display name, covered areas) lives in its own collection.
    category: Types.ObjectId;
    referralCode?: string;
    qualification: string;
    yearsOfExperience: number;
    bio: string;
    photograph: string;
    remuneration: number;
    /**
     * Whether a subscription consultation credit may be spent on this expert.
     *
     * A credit is priced against the in-house session fee. An external specialist
     * charging several times that would cost more to fulfil than the plan brought in —
     * six credits at ₹700 exceeds the ₹3,999 half-yearly plan outright. Off-panel
     * experts stay fully bookable, but pay-per-session only.
     *
     * Defaults to false: an expert is off-panel until someone deliberately empanels
     * them, so a newly added specialist can never quietly start consuming credits.
     */
    is_empanelled_expert: boolean;
    isActive: boolean;
    /**
     * Where this expert's booking notifications are sent, with country code and no `+`.
     * Every expert currently points at the coordinator's number rather than their own —
     * she confirms the exact time with the doctor by hand. Pointing an expert at their
     * own WhatsApp later is a DB edit, not a deploy, which is the whole reason this is a
     * field and not a constant.
     */
    contactWhatsappNumber?: string | null;
    translations?: IExpertTranslations;
}
