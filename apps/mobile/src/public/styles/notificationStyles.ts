import { StyleSheet } from 'react-native';
import { colors } from '../assets/colors';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  card: {
    borderWidth: 1,
    borderColor: colors.notoficatioBorder,
    padding: 14,
    borderRadius: 10,
    marginBottom: 12,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 6,
    color: '#000',
    textTransform: 'capitalize',
  },
  message: {
    fontSize: 13,
    color: '#444',
  },
});
