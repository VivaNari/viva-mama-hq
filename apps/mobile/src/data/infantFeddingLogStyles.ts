import { Platform, StyleSheet } from 'react-native';
import { colors } from '../public/assets/colors';

export const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
  },
  backButton: {
    fontSize: 30,
    color: '#1F2937',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  dateScrollView: {
    flexGrow: 0,
  },
  dateContainer: {
    paddingVertical: 16,
  },
  dateTab: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
    marginRight: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  selectedDateTab: {
    backgroundColor: '#6D28D9',
    borderColor: '#6D28D9',
  },
  disabledDateTab: {
    backgroundColor: '#F3F4F6',
    opacity: 0.6,
  },
  dateText: {
    color: '#4B5563',
    fontWeight: '500',
  },
  selectedDateText: {
    color: '#FFFFFF',
  },
  disabledDateText: {
    color: '#9CA3AF',
  },
  container: {
    flex: 1,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionHeader: {
    alignSelf: 'flex-start',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sleepRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: Platform.OS === 'ios' ? 12 : 8,
    backgroundColor: '#F9FAFB',
    flex: 1,
    marginHorizontal: 4,
    color: colors.black,
  },
  timeInput: { flex: 0.6 },
  amountInput: { flex: 0.5 },
  radioContainer: {
    alignItems: 'center',
    marginHorizontal: 8,
  },
  radioLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 6,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#D1D5DB',
  },
  radioSelected: {
    backgroundColor: '#6D28D9',
    borderColor: '#6D28D9',
  },
  addMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    padding: 4,
  },
  addMoreText: {
    marginLeft: 6,
    color: '#4B5563',
    fontWeight: '500',
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    backgroundColor: '#F9FAFB',
  },
  checkboxChecked: {
    backgroundColor: '#6D28D9',
    borderColor: '#6D28D9',
  },
  checkboxLabel: {
    fontSize: 16,
    color: '#374151',
  },
  checkmarkIcon: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  plusIcon: {
    fontSize: 20,
    color: '#4B5563',
  },
});
