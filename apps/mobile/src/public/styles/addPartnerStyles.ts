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
    marginBottom: 10,
    color: '#000',
  },
  headerSubtitle: {
    fontSize: 14,
    marginBottom: 10,
    color: '#000',
  },
  benefitText: {
    fontSize: 12,
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
    fontSize: 20,
  },
  sensitiveText: {
    fontSize: 12,
    color: '#444',
    marginTop: 10,
  },
  stepsTitle: {
    fontSize: 16,
    marginBottom: 12,
    color: '#000',
  },
  stepItem: {
    marginBottom: 15,
  },
  stepTitle: {
    fontSize: 12,
    marginBottom: 4,
    color: '#000',
  },
  stepDescription: {
    fontSize: 10,
    color: '#444',
  },
});
