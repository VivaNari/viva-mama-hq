import { Schema } from "mongoose";
import { EUserCategory } from "./user.types";

export interface IContent {
    _id: Schema.Types.ObjectId;
    featuredImage: string;
    featuredTitle: string;
    category: EUserCategory;
    validWeekStart: number;
    validWeekEnd: number;
    authors: Schema.Types.ObjectId[];
    reviewers: Schema.Types.ObjectId[];
    contentBody: IContentBody[];
}

export enum ContentBodyTypeEnum {
    IMAGE = "IMAGE",
    HEADING = "HEADING",
    SUBHEADING = "SUBHEADING",
    PARAGRAPH = "PARAGRAPH",
}

export interface IContentBody {
    contentType: ContentBodyTypeEnum;
    body: string;
}
