import { StyleSheet } from "react-native";

import { colors } from "../assets/colors";

export const journeyStyles = StyleSheet.create({
  section: { gap: 12, marginBottom: 12 },

  // Stage bar
  bar: {
    borderWidth: 1,
    borderColor: colors.journeySegOff,
    borderRadius: 16,
    padding: 13,
  },
  barCaption: { fontSize: 10, letterSpacing: 0.9, color: colors.journeyMuted },
  barRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    marginTop: 3,
    marginBottom: 8,
    gap: 8,
  },
  barStage: { fontSize: 17, color: colors.vivaInk, flexShrink: 1 },
  barWhere: { fontSize: 12, color: colors.journeyMuted },
  barSegments: { flexDirection: "row", gap: 4 },
  barSegment: {
    flex: 1,
    height: 6,
    borderRadius: 99,
    backgroundColor: colors.journeySegOff,
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
    borderRadius: 99,
    backgroundColor: colors.darkPurple,
  },
  barNames: { flexDirection: "row", gap: 4, marginTop: 5 },
  barName: {
    flex: 1,
    fontSize: 9.5,
    lineHeight: 12,
    color: colors.journeyMuted,
  },
  barNameOn: { color: colors.darkPurple },

  // Card rail
  rail: { marginHorizontal: -20 },
  railContent: { paddingHorizontal: 20, gap: 12 },
  dots: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
    marginTop: 10,
  },
  dot: {
    height: 7,
    width: 7,
    borderRadius: 99,
    backgroundColor: colors.vivaStripOff,
  },
  dotOn: { width: 20, backgroundColor: colors.darkPurple },

  // Cards
  card: { borderRadius: 26, overflow: "hidden" },
  cardPad: { padding: 18, gap: 10, flex: 1 },
  cardLabel: { fontSize: 12 },
  cardHeading: { fontSize: 22, color: colors.vivaInk },
  cardBody: { fontSize: 14, lineHeight: 21, color: colors.journeyBody },

  // Media panel
  media: {
    margin: 10,
    marginBottom: 0,
    borderRadius: 20,
    overflow: "hidden",
    justifyContent: "flex-start",
  },
  mediaImage: {
    ...StyleSheet.absoluteFillObject,
    width: "100%",
    height: "100%",
  },
  badge: {
    alignSelf: "flex-start",
    margin: 12,
    borderRadius: 99,
    paddingVertical: 4,
    paddingHorizontal: 10,
    maxWidth: "85%",
  },
  badgeText: { fontSize: 11 },

  // Happening
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: {
    backgroundColor: colors.white,
    borderRadius: 99,
    paddingVertical: 5,
    paddingHorizontal: 10,
  },
  chipText: { fontSize: 12, color: colors.journeyTealText },
  learnBox: {
    backgroundColor: colors.white,
    borderRadius: 14,
    padding: 12,
    gap: 2,
  },
  learnTitle: { fontSize: 12, color: colors.darkPurple },
  learnText: { fontSize: 13, lineHeight: 19, color: colors.journeyBody },
  learnButton: {
    marginTop: "auto",
    alignSelf: "flex-start",
    backgroundColor: colors.white,
    borderRadius: 99,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  learnButtonText: { fontSize: 12, color: colors.darkPurple },

  // Coming up
  dateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.white,
    borderRadius: 18,
    padding: 12,
  },
  dateWhen: { width: 56, alignItems: "center" },
  dateWhenBig: {
    fontSize: 16,
    lineHeight: 19,
    color: colors.journeyTealText,
    textAlign: "center",
  },
  dateWhenSmall: {
    fontSize: 11,
    color: colors.journeyTealText,
    textAlign: "center",
  },
  dateBody: { flex: 1, gap: 2 },
  dateLabel: { fontSize: 13.5, lineHeight: 18, color: colors.vivaInk },
  dateTiming: { fontSize: 11, color: colors.journeyMuted },
  bigButton: {
    minHeight: 48,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  bigButtonText: { fontSize: 14, color: colors.white },
  linkButton: {
    alignSelf: "center",
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  linkText: { fontSize: 13, color: colors.journeyTealText },

  // Remember
  tile: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 56,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: colors.white,
  },
  tileIcon: {
    width: 28,
    height: 28,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.journeyRememberBG,
  },
  tileBody: { flex: 1 },
  tileText: { fontSize: 13.5, lineHeight: 18, color: colors.vivaInk },
  tileSub: { fontSize: 11, color: colors.journeyMuted },
  kickButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.darkPurple,
  },
  kickCount: { fontSize: 18, color: colors.white },

  // When to get help
  helpLink: { alignSelf: "center", paddingVertical: 10, paddingHorizontal: 14 },
  helpLinkText: { fontSize: 13, color: colors.vivaDangerText },
  helpBox: {
    borderWidth: 1,
    borderColor: colors.vivaDangerBorder,
    backgroundColor: colors.vivaDangerBG,
    borderRadius: 16,
    padding: 14,
    gap: 6,
    marginBottom: 12,
  },
  helpHeading: { fontSize: 13.5, color: colors.vivaDangerText },
  helpSign: { fontSize: 13, lineHeight: 19, color: colors.vivaInk },
  helpNumbers: { marginTop: 6, gap: 8 },
  helpNumberRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
  },
  helpNumberLabel: { fontSize: 12.5, color: colors.journeyBody, minWidth: 100 },
  helpCall: {
    minHeight: 36,
    justifyContent: "center",
    backgroundColor: colors.vivaDangerText,
    borderRadius: 99,
    paddingHorizontal: 14,
  },
  helpCallText: { fontSize: 13, color: colors.white },

  // Baby
  babyCard: {
    borderRadius: 28,
    overflow: "hidden",
    backgroundColor: colors.journeyTealBG,
    marginBottom: 12,
  },
  mini: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 12,
  },
  miniLabel: { width: 76, fontSize: 11, color: colors.journeyTealText },
  miniText: { flex: 1, fontSize: 13, lineHeight: 19, color: colors.vivaInk },
  smallNote: { fontSize: 11, color: colors.journeyMuted },

  // Delivery prompt and notices
  prompt: {
    backgroundColor: colors.vivaSelectedBG,
    borderRadius: 16,
    padding: 14,
    gap: 8,
  },
  promptTitle: { fontSize: 15, color: colors.vivaInk },
  promptButton: { backgroundColor: colors.darkPurple },
  promptButtonQuiet: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.darkPurple,
  },
  promptButtonQuietText: { color: colors.darkPurple },
  notice: {
    backgroundColor: colors.vivaSelectedBG,
    borderRadius: 26,
    padding: 22,
    gap: 10,
    marginBottom: 12,
  },

  // Birth sheet
  sheetBackdrop: {
    flex: 1,
    backgroundColor: "rgba(36,31,46,0.35)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 20,
    gap: 12,
  },
  sheetTitle: { fontSize: 20, color: colors.vivaInk },
  sheetLabel: { fontSize: 13, color: colors.journeyMuted, marginTop: 4 },
  option: {
    minHeight: 48,
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.vivaBorder,
    borderRadius: 14,
    backgroundColor: colors.vivaBG,
    paddingHorizontal: 14,
  },
  optionOn: {
    borderColor: colors.darkPurple,
    backgroundColor: colors.vivaSelectedBG,
  },
  optionText: { fontSize: 14, color: colors.vivaInk },
  sheetError: { fontSize: 13, color: colors.vivaDangerText },
});
