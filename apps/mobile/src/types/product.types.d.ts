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
  productAffiliateLink: string;
  userCategory: UserCategoryEnum;
  validWeekStart: number;
  validWeekEnd: number;
  productCategory: string;
  productDescription: string;
  productPriceRange: string;
  safetyFlag: string;
}
