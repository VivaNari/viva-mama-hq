import { isIOS } from '../utils/platformUtil';

export const fontFamilies = {
  LEXEND: {
    light: isIOS() ? 'Lexend-Light' : 'LexendLight',
    regular: isIOS() ? 'Lexend-Regular' : 'LexendRegular',
    medium: isIOS() ? 'Lexend-Medium' : 'LexendMedium',
    bold: isIOS() ? 'Lexend-Bold' : 'LexendBold',
    semibold: isIOS() ? 'Lexend-SemiBold' : 'LexendSemiBold',
    extrabold: isIOS() ? 'Lexend-ExtraBold' : 'LexendExtraBold',
  },
};
