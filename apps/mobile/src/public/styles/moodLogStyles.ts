import { StyleSheet } from 'react-native';
import { colors } from '../assets/colors';

export const moodLogStyles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.pageBG,
  },

  // ---- Date strip ----
  stripWrapper: {
    paddingVertical: 12,
    paddingHorizontal: 5,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.white,
    flexDirection: 'row',
    alignItems: 'center',
  },
  stripList: {
    paddingHorizontal: 12,
    gap: 10,
    alignItems: 'center',
  },
  dateChip: {
    width: 54,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.lightGray,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateChipSelected: {
    backgroundColor: colors.SubscriptionOptionsBG,
    borderColor: colors.purple,
    borderWidth: 2,
  },
  dateChipToday: {
    borderColor: colors.purple,
  },
  weekdayText: {
    fontSize: 11,
    color: colors.darkGray,
  },
  dayNumberText: {
    fontSize: 16,
    color: colors.text,
    marginTop: 2,
  },
  dayNumberTextSelected: {
    color: colors.darkPurple,
  },
  chipEmoji: {
    fontSize: 16,
    marginTop: 4,
    height: 20,
  },
  chipEmojiPlaceholder: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 7,
    backgroundColor: colors.mediumGray,
  },
  pickerButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: 12,
    marginLeft: 4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.SubscriptionOptionsBG,
  },

  // ---- Body ----
  body: {
    flex: 1,
  },
  bodyContent: {
    padding: 20,
    paddingBottom: 40,
  },
  selectedDateLabel: {
    fontSize: 18,
    color: colors.text,
    textAlign: 'center',
    marginBottom: 4,
  },
  prompt: {
    fontSize: 14,
    color: colors.darkGray,
    textAlign: 'center',
    marginBottom: 18,
  },

  // ---- Hero ----
  hero: {
    alignItems: 'center',
    marginBottom: 8,
  },
  heroCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  heroEmoji: {
    fontSize: 52,
    lineHeight: 62,
    textAlign: 'center',
    textAlignVertical: 'center',
    includeFontPadding: false,
  },
  heroLabel: {
    fontSize: 20,
    color: colors.text,
  },
  heroCaption: {
    fontSize: 13,
    color: colors.darkGray,
    marginTop: 4,
    textAlign: 'center',
  },

  // ---- Scattered bubble cluster ----
  cluster: {
    height: 220,
    marginVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bubble: {
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 4,
  },
  bubbleCircle: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    borderWidth: 2,
    borderColor: 'transparent',
    backgroundColor: colors.white,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 3,
  },
  bubbleLabel: {
    fontSize: 11,
    color: colors.darkGray,
    marginTop: 6,
    textAlign: "center"
  },
  bubbleLabelSelected: {
    color: colors.darkPurple,
  },

  // ---- Actions ----
  saveButton: {
    marginTop: 20,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    backgroundColor: colors.darkPurple,
  },
  saveButtonDisabled: {
    backgroundColor: colors.mediumGray,
  },
  saveButtonText: {
    color: colors.white,
    fontSize: 16,
  },
  deleteButton: {
    marginTop: 14,
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 14,
    paddingVertical: 13,
    paddingHorizontal: 18,
    borderWidth: 1.5,
    borderColor: colors.redBadgeText,
    backgroundColor: colors.redBadgeBG,
  },
  deleteButtonDisabled: {
    opacity: 0.6,
  },
  deleteButtonText: {
    color: colors.redBadgeText,
    fontSize: 15,
    letterSpacing: 0.2,
  },

  // ---- Empty / loading ----
  centerFill: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  emptyText: {
    fontSize: 14,
    color: colors.darkGray,
    textAlign: 'center',
    marginTop: 10,
  },
});
