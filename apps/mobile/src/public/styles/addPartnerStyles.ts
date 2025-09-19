import { StyleSheet } from 'react-native';
import { colors } from '../assets/colors';

export const styles = StyleSheet.create({
  headerWrapper: {
    // light purple background
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 10,
    color: '#000',
  },
  headerSubtitle: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 10,
    color: '#000',
  },
  benefitText: {
    fontSize: 14,
    color: '#444',
    marginBottom: 5,
    marginLeft: 15,
  },
  card: {
    backgroundColor: '#f2f2f2',
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 3,
  },
  codeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  codeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.subscriptionTabActiveBG,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 10,
  },
  code: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  sensitiveText: {
    fontSize: 13,
    color: '#444',
    marginTop: 10,
  },
  stepsTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
    color: '#000',
  },
  stepItem: {
    marginBottom: 15,
  },
  stepTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
    color: '#000',
  },
  stepDescription: {
    fontSize: 13,
    color: '#444',
  },
});
