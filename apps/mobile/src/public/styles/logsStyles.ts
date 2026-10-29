import { StyleSheet } from "react-native";
import { colors } from "../assets/colors";

// Shared by the Viva AI hub, the Log Picker, every mother log screen and Reminders.
// Sizes follow the 1000-day design (390pt wide frames).
export const logsStyles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.vivaBG,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 28,
    gap: 14,
  },

  // ---- Header ----
  header: {
    paddingTop: 18,
    paddingBottom: 14,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.vivaDivider,
  },
  backButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.vivaBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 17,
    color: colors.vivaInk,
  },
  headerSubtitle: {
    fontSize: 11.5,
    color: colors.vivaMuted,
  },

  // ---- Text ----
  sectionTitle: {
    fontSize: 13,
    color: colors.vivaInk,
  },
  questionTitle: {
    fontSize: 14,
    color: colors.vivaInk,
  },
  stepTitle: {
    fontSize: 15,
    color: colors.vivaInk,
  },
  fieldLabel: {
    fontSize: 12,
    color: colors.vivaSubtle,
  },
  mutedLabel: {
    fontSize: 12,
    color: colors.vivaMuted,
  },
  capsLabel: {
    fontSize: 11,
    color: colors.vivaLabel,
    letterSpacing: 0.3,
  },
  quickPickLabel: {
    fontSize: 11,
    color: colors.vivaFaint,
  },
  bodyMuted: {
    fontSize: 13,
    color: colors.vivaMuted,
    textAlign: "center",
  },
  disclaimer: {
    fontSize: 11,
    color: colors.vivaFaint,
    lineHeight: 17,
    textAlign: "center",
  },
  footnote: {
    fontSize: 10.5,
    color: colors.vivaFaint,
    lineHeight: 16,
  },

  // ---- Notes and banners ----
  tintNote: {
    backgroundColor: colors.vivaTint,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  tintNoteText: {
    fontSize: 12.5,
    color: colors.vivaTintText,
    lineHeight: 20,
  },
  amberNote: {
    backgroundColor: colors.vivaAmberBG,
    borderWidth: 1,
    borderColor: colors.vivaAmberBorder,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  amberNoteText: {
    fontSize: 12,
    color: colors.vivaAmberText,
    lineHeight: 18,
  },
  successPill: {
    alignSelf: "center",
    backgroundColor: colors.vivaSuccessBG,
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 18,
  },
  successPillText: {
    fontSize: 13,
    color: colors.vivaSuccess,
  },

  // ---- Cards and rows ----
  card: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.vivaDivider,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 8,
  },
  listRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.vivaDivider,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    gap: 10,
  },
  listRowLabel: {
    fontSize: 13,
    color: colors.vivaInk,
    flexShrink: 1,
  },
  listRowValue: {
    fontSize: 13,
    color: colors.vivaMuted,
  },
  spaceBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
  },
  iconBadge: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: colors.vivaTint,
    alignItems: "center",
    justifyContent: "center",
  },
  itemCard: {
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1.5,
    borderColor: colors.vivaBorder,
    backgroundColor: colors.white,
  },
  itemCardDone: {
    borderColor: colors.vivaSuccessBorder,
    backgroundColor: colors.vivaSuccessCardBG,
  },
  itemTitle: {
    fontSize: 13.5,
    color: colors.vivaInk,
  },
  itemSub: {
    fontSize: 11.5,
    color: colors.vivaMuted,
  },
  itemBody: {
    flex: 1,
    gap: 2,
  },
  smallActionButton: {
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1.5,
    borderColor: colors.darkPurple,
    backgroundColor: colors.white,
  },
  smallActionButtonDone: {
    backgroundColor: colors.vivaSuccessBG,
    borderColor: colors.vivaSuccessBorder,
  },
  smallActionText: {
    fontSize: 11.5,
    color: colors.darkPurple,
  },
  smallActionTextDone: {
    color: colors.vivaSuccessText,
  },

  // Full-width single-choice card (scan type, ANC checks).
  choiceCard: {
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 1.5,
    borderColor: colors.vivaBorder,
    backgroundColor: colors.white,
  },
  choiceCardOn: {
    borderWidth: 2,
    borderColor: colors.darkPurple,
    backgroundColor: colors.vivaSelectedBG,
  },
  mchNote: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 11,
    backgroundColor: colors.vivaSelectedBG,
    borderWidth: 1.5,
    borderColor: colors.vivaMchBorder,
    borderRadius: 14,
    paddingVertical: 13,
    paddingHorizontal: 15,
  },
  mchNoteText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
    color: colors.vivaMchText,
  },
  textInput: {
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.vivaBorder,
    backgroundColor: colors.white,
    paddingVertical: 11,
    paddingHorizontal: 14,
    fontSize: 13,
    color: colors.vivaInk,
  },

  // ---- Reminders ----
  cancelPill: {
    borderRadius: 999,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderWidth: 1.5,
    borderColor: colors.vivaDangerBorder,
    backgroundColor: colors.vivaDangerBG,
  },
  cancelPillText: {
    fontSize: 11,
    color: colors.vivaDangerText,
  },
  emptyText: {
    textAlign: "center",
    paddingVertical: 30,
    paddingHorizontal: 10,
    fontSize: 12.5,
    color: colors.vivaFaint,
  },
  categoryTile: {
    width: "48.5%",
    borderRadius: 14,
    padding: 14,
    gap: 8,
    borderWidth: 1.5,
    borderColor: colors.vivaBorder,
    backgroundColor: colors.white,
  },
  categoryTileWide: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  categoryTileOn: {
    backgroundColor: colors.darkPurple,
    borderColor: colors.darkPurple,
  },
  startDateBox: {
    backgroundColor: colors.vivaTrack,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  endOption: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderWidth: 1.5,
    borderColor: colors.vivaBorder,
    backgroundColor: colors.white,
    justifyContent: "center",
  },
  weeksBox: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 18,
    backgroundColor: colors.vivaSelectedBG,
    borderRadius: 14,
    padding: 12,
    marginTop: 4,
  },
  weeksButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: colors.darkPurple,
    alignItems: "center",
    justifyContent: "center",
  },

  // ---- Chips ----
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    borderRadius: 999,
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderWidth: 1.5,
  },
  chipSmall: {
    paddingVertical: 8,
    paddingHorizontal: 13,
  },
  chipText: {
    fontSize: 12.5,
  },
  chipTextSmall: {
    fontSize: 12,
  },

  // ---- Segmented toggle ----
  toggleTrack: {
    flexDirection: "row",
    backgroundColor: colors.vivaTrack,
    borderRadius: 999,
    padding: 4,
    gap: 4,
  },
  toggleOption: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 999,
    alignItems: "center",
  },
  toggleOptionActive: {
    backgroundColor: colors.darkPurple,
  },
  toggleText: {
    fontSize: 13,
    color: colors.darkPurple,
  },
  toggleTextActive: {
    color: colors.white,
  },
  tabTrack: {
    flexDirection: "row",
    backgroundColor: colors.vivaDivider,
    borderRadius: 14,
    padding: 4,
    gap: 8,
  },
  tabOption: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 11,
    alignItems: "center",
  },
  tabOptionActive: {
    backgroundColor: colors.white,
    shadowColor: colors.darkPurple,
    shadowOpacity: 0.12,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  tabText: {
    fontSize: 12.5,
    color: colors.vivaSubtle,
  },
  tabTextActive: {
    color: colors.darkPurple,
  },

  // ---- Stepper ----
  stepperRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 18,
  },
  stepperColumn: {
    alignItems: "center",
    gap: 8,
  },
  stepperButton: {
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: colors.vivaBorder,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
  },
  stepperValueBlock: {
    alignItems: "center",
  },
  stepperValue: {
    color: colors.vivaInk,
  },
  stepperUnit: {
    fontSize: 11,
    color: colors.vivaMuted,
  },

  // ---- Buttons ----
  primaryButton: {
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.darkPurple,
    flexDirection: "row",
    gap: 8,
  },
  primaryButtonRounded: {
    borderRadius: 12,
    paddingVertical: 12,
  },
  primaryButtonDisabled: {
    backgroundColor: colors.vivaDisabled,
  },
  primaryButtonText: {
    fontSize: 14,
    color: colors.white,
  },
  secondaryButton: {
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: colors.vivaBorder,
    backgroundColor: colors.white,
  },
  secondaryButtonText: {
    fontSize: 13,
    color: colors.vivaSubtle,
  },
  buttonPair: {
    flexDirection: "row",
    gap: 10,
  },
  linkButton: {
    alignSelf: "center",
    paddingVertical: 4,
  },
  linkButtonText: {
    fontSize: 12.5,
    color: colors.vivaMuted,
    textDecorationLine: "underline",
  },
  dashedButton: {
    borderRadius: 14,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: colors.vivaDashed,
    backgroundColor: colors.vivaSelectedBG,
  },
  dashedButtonDone: {
    borderStyle: "solid",
    borderColor: colors.vivaSuccessBorder,
    backgroundColor: colors.vivaSuccessBG,
  },
  dashedButtonText: {
    fontSize: 13,
    color: colors.darkPurple,
  },
  dashedButtonTextDone: {
    color: colors.vivaSuccess,
  },

  // ---- Progress ----
  progressTrack: {
    height: 10,
    backgroundColor: colors.vivaBorder,
    borderRadius: 999,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
  },

  // ---- Big tap dial (kick counter, water) ----
  dialArea: {
    alignItems: "center",
    gap: 18,
    paddingVertical: 20,
  },
  dial: {
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  dialValue: {
    color: colors.white,
  },
  dialCaption: {
    fontSize: 13,
    color: colors.vivaHeroText,
  },

  // ---- Done state ----
  doneWrap: {
    alignItems: "center",
    gap: 14,
    paddingTop: 30,
  },
  doneIcon: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: colors.vivaSuccessBG,
    alignItems: "center",
    justifyContent: "center",
  },
  doneTitle: {
    fontSize: 16,
    color: colors.vivaInk,
    textAlign: "center",
  },
  doneSub: {
    fontSize: 13,
    color: colors.vivaMuted,
    textAlign: "center",
  },

  // ---- Option tiles (hub and picker) ----
  tileGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 12,
  },
  tile: {
    width: "48.3%",
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.vivaBorder,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 14,
    gap: 10,
  },
  tileWide: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  tileReading: {
    backgroundColor: colors.vivaAmberBG,
    borderColor: colors.vivaAmberBorder,
  },
  tileMood: {
    backgroundColor: colors.vivaMoodBG,
    borderColor: colors.vivaMoodBorder,
  },
  tileIcon: {
    width: 30,
    height: 30,
    borderRadius: 9,
    backgroundColor: colors.vivaTint,
    alignItems: "center",
    justifyContent: "center",
  },
  tileIconLarge: {
    width: 40,
    height: 40,
    borderRadius: 12,
  },
  tileIconOnTone: {
    backgroundColor: colors.white,
  },
  tileLabel: {
    fontSize: 13.5,
    color: colors.vivaInk,
    lineHeight: 18,
  },
  tileLabelLarge: {
    fontSize: 14,
  },
  tileSub: {
    fontSize: 11,
    color: colors.vivaMuted,
    marginTop: 2,
  },
});
