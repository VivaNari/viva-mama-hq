import { Schema } from "mongoose";

export interface IProduct {
    _id: Schema.Types.ObjectId;
    productImageURL: string;
    productName: string;
    productAffiliateLink: string;
    userCategory: string;
    validWeeks: number[];
}
