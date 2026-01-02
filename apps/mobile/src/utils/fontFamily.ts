import { fontFamilies } from "../constants/fonts";

export enum EFontWeight {
  LIGHT = "light",
  REGULAR = "regular",
  MEDIUM = "medium",
  BOLD = "bold",
  SEMIBOLD = "semibold",
  EXTRABOLD = "extrabold",
}

export const getFontFamily = (weight: EFontWeight) => {
  return fontFamilies.YSABEAU_INFANT[weight];
};
