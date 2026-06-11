import { Schema } from "mongoose";

export interface IProduct {
    _id: Schema.Types.ObjectId;
    productImageURL: string;
    productName: string;
    productAffiliateLink: string;
    userCategory: string;
    validWeekStart: number;
    validWeekEnd: number;
    productCategory: string;
    productDescription: string;
    productPriceRange: string;
    safetyFlag: string;
}
