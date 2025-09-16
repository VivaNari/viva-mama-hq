import { StyleSheet } from 'react-native';
import { colors } from '../assets/colors';

export const landingStyles = StyleSheet.create({
  welcomeText: {
    fontWeight: 700,
    fontSize: 36,
    textAlign: 'center',
    color: colors.primary,
  },
  welcomeCaption: {
    fontWeight: 400,
    fontSize: 16,
    textAlign: 'center',
    color: colors.secondary,
  },
});
