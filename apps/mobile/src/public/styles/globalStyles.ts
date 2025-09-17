import { StyleSheet } from 'react-native';
import { colors } from '../assets/colors';

export const globalStyles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  headingxl: {
    fontWeight: 600,
    fontStyle: 'normal',
    fontSize: 20,
    textAlign: 'center',
  },
  input: {
    padding: 10,
    borderRadius: 5,
    borderBottomWidth: 1,
    borderBottomColor: colors.secondary,
    marginVertical: 8,
    color: colors.white,
    height: 52,
    backgroundColor: '#9C9C9C',
    justifyContent: 'center',
  },
  inputHovered: {
    padding: 10,
    borderRadius: 4,
    borderBottomWidth: 2,
    borderBlockColor: colors.primary,
    marginVertical: 8,
    color: colors.primary,
    backgroundColor: colors.offWhite,
    height: 52,
    justifyContent: 'center',
  },
  inputSelected: {
    padding: 10,
    borderRadius: 4,
    borderBottomWidth: 2,
    borderBlockColor: colors.primary,
    marginVertical: 8,
    color: colors.primary,
    backgroundColor: colors.primary,
    height: 52,
    justifyContent: 'center',
  },
});
