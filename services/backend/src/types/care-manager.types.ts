import { Document } from "mongoose";
import { FlowLanguage } from "./chat.types";

/** Translatable display fields of a care manager for one non-default language. */
export interface ICareManagerTranslationBundle {
    name?: string;
}

export type ICareManagerTranslations = Partial<Record<FlowLanguage, ICareManagerTranslationBundle>>;

export interface ICareManager extends Document {
    name: string;
    email: string;
    phoneNumber: string;
    /**
     * Where this care manager's booking notifications are sent, with country code and no
     * `+`. Deliberately separate from `phoneNumber`, which stays the care manager's own
     * contact detail: today every booking is routed to the coordinator, who confirms the
     * exact time by hand. Mirrors IExpert.contactWhatsappNumber.
     */
    contactWhatsappNumber?: string | null;
    /**
     * Pay-per-session fee in rupees, charged when the user has no care-manager credit —
     * every FREE and TRIAL user, plus premium users who have run through their bucket.
     * Per-counsellor rather than a global constant so a rate can diverge without a
     * release; seeded flat today. Mirrors IExpert.remuneration.
     */
    remuneration: number;
    imageUrl?: string;
    translations?: ICareManagerTranslations;
}
