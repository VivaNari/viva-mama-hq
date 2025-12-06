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
