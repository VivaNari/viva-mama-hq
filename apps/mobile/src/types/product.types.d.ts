import { UserCategoryEnum } from "./user.types";

export interface IProduct {
  productImage: number; // because require() returns a number
  productName: string;
  productURL: string;
}

export interface IUserProductResponse {
  statusCode: number;
  success: boolean;
  data: IUserProduct[];
  message: string;
}
export interface IUserProduct {
  _id: string;
  productImageURL: string;
  productName: string;
  /** Absent on locked products — shipping the link would defeat the blur. */
  productAffiliateLink?: string;
  /** A product can serve several audiences, e.g. both PP and NP. */
  userCategory: UserCategoryEnum[];
  validWeekStart: number;
  validWeekEnd: number;
  productCategory: string;
  productDescription: string;
  productPriceRange: string;
  safetyFlag: string;
  /** Set by the server when the user's tier does not include this product. */
  isLocked?: boolean;
}
