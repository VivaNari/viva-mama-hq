import { Schema } from "mongoose";
import { EUserCategory } from "./user.types";

/** What is stored. NEEDS_REVIEW and NO_SUMMARY are derived, see EContentProfileState. */
export enum EContentProfileStatus {
    DRAFT = "DRAFT",
    NEEDS_MANUAL = "NEEDS_MANUAL",
    APPROVED = "APPROVED",
}

/** What the admin sees. Only APPROVED may ever be suggested. */
export enum EContentProfileState {
    NO_SUMMARY = "NO_SUMMARY",
    DRAFT = "DRAFT",
    NEEDS_MANUAL = "NEEDS_MANUAL",
    APPROVED = "APPROVED",
    /** The content changed after this profile was written. */
    NEEDS_REVIEW = "NEEDS_REVIEW",
}

export enum EContentMediaType {
    ARTICLE = "ARTICLE",
    VIDEO = "VIDEO",
    MIXED = "MIXED",
}

export interface IContentExampleQuestion {
    text: string;
    language: "en" | "hi" | "hinglish";
    /** mm:ss where a video answers it. A reviewing aid, not proof. */
    timestamp?: string | null;
}

export interface IContentProfileFields {
    summary: string;
    oneLiner: string;
    keywordsEn: string[];
    keywordsHi: string[];
    exampleQuestions: IContentExampleQuestion[];
    /** Stages this may be suggested to. Separate from contents.category, which is broader. */
    suitableFor: EUserCategory[];
}

export interface IContentSearchProfile extends IContentProfileFields {
    _id: Schema.Types.ObjectId;
    contentId: Schema.Types.ObjectId;
    status: EContentProfileStatus;
    /** Fingerprint of the content this was written from. */
    sourceHash: string;
    /** Whether the draft was made from the video as well as the text. */
    videoChecked: boolean;
    /** Bumped on every write, so two people cannot overwrite each other. */
    revision: number;
    approvedAt: Date | null;
    approvedBy: Schema.Types.ObjectId | null;
    createdAt: Date;
    updatedAt: Date;
}
