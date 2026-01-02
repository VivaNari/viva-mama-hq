import { isIOS } from "../utils/platformUtil";

export const fontFamilies = {
  LEXEND: {
    light: isIOS() ? "Lexend-Light" : "LexendLight",
    regular: isIOS() ? "Lexend-Regular" : "LexendRegular",
    medium: isIOS() ? "Lexend-Medium" : "LexendMedium",
    bold: isIOS() ? "Lexend-Bold" : "LexendBold",
    semibold: isIOS() ? "Lexend-SemiBold" : "LexendSemiBold",
    extrabold: isIOS() ? "Lexend-ExtraBold" : "LexendExtraBold",
  },
  YSABEAU_INFANT: {
    light: isIOS() ? "YsabeauInfant-Light" : "YsabeauInfantLight",
    regular: isIOS() ? "YsabeauInfant-Regular" : "YsabeauInfantRegular",
    medium: isIOS() ? "YsabeauInfant-Medium" : "YsabeauInfantMedium",
    bold: isIOS() ? "YsabeauInfant-Bold" : "YsabeauInfantBold",
    semibold: isIOS() ? "YsabeauInfant-SemiBold" : "YsabeauInfantSemiBold",
    extrabold: isIOS() ? "YsabeauInfant-ExtraBold" : "YsabeauInfantExtraBold",
  },
};
