import { IExpert } from "./expert.types";
import { UserCategoryEnum } from "./user.types";

export interface IContent {
  id: number;
  title: string;
  author: string;
  thumbnailImage: number;
  isBookmarked: boolean;
  likes: number;
  comments: number;
  content: string;
}

export interface ISubCategory {
  id: number;
  subCategoryName: string;
  contents: IContent[];
}

export interface ICategory {
  id: number;
  categoryName: string;
  categoryThumbnailImage: number;
  categoryIcon: number;
  subCategories: ISubCategory[];
}

export interface IUserContentresponse {
  statusCode: number;
  success: boolean;
  data: IUserContent[];
  message: string;
}
export interface IUserContent {
  _id: string;
  featuredImage: string;
  featuredTitle: string;
  category: UserCategoryEnum;
  authors: IExpert[];
  reviewers: IExpert[];
  contentBody: IContentBody[];
}

export enum ContentBodyTypeEnum {
  IMAGE = "IMAGE",
  HEADING = "HEADING",
  SUBHEADING = "SUBHEADING",
  PARAGRAPH = "PARAGRAPH",
}

export interface IContentBody {
  _id: string;
  contentType: ContentBodyTypeEnum;
  body: string;
}
