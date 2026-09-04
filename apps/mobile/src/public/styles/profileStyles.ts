import { StyleSheet } from 'react-native';
import { colors } from '../assets/colors';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.pageBG,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },

  // Grouping card for a section of fields
  card: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  sectionHeader: {
    fontSize: 17,
    color: colors.darkPurple,
    letterSpacing: 0.3,
    marginBottom: 2,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: colors.gray,
    marginBottom: 4,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 4,
  },

  // A single field block (label + control)
  fieldBlock: {
    marginTop: 16,
  },
  questionLabel: {
    fontSize: 15,
    color: colors.text,
    marginBottom: 8,
  },

  // Text / date input box
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    borderRadius: 12,
    paddingHorizontal: 14,
    minHeight: 50,
    justifyContent: 'center',
  },
  inputFocusedValue: {
    fontSize: 16,
    color: colors.black,
  },

  // Selectable option row
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.white,
    paddingVertical: 13,
    paddingHorizontal: 14,
    borderRadius: 12,
    marginVertical: 5,
  },
  optionRowSelected: {
    borderColor: colors.darkPurple,
    backgroundColor: colors.lightPurple,
  },
  optionText: {
    flex: 1,
    fontSize: 15,
    color: colors.text,
  },
  optionTextSelected: {
    color: colors.darkPurple,
  },

  // Read-only value pill (e.g. locked delivery date, already-set contact)
  readOnlyValue: {
    fontSize: 16,
    color: colors.darkGray,
    backgroundColor: colors.lightGray,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },

  helperText: {
    fontSize: 12,
    color: colors.gray,
    marginTop: 6,
  },
  errorText: {
    fontSize: 12,
    color: colors.error,
    marginTop: 6,
  },
  successRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  successText: {
    fontSize: 12,
    color: colors.success,
    marginLeft: 4,
  },

  saveButton: {
    marginTop: 8,
    paddingVertical: 16,
    borderRadius: 28,
    alignItems: 'center',
  },
  saveText: {
    color: colors.white,
    fontSize: 16,
    letterSpacing: 0.3,
  },
});
