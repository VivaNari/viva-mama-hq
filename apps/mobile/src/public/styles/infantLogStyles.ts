import { StyleSheet } from "react-native";

import { colors } from "../assets/colors";

/**
 * Shared chrome for the five infant log screens: Growth, Feeding, Diaper, Vaccination and
 * Milestone.
 *
 * They are one design language — a page on pageBG, white cards, a blue pill naming each
 * section, a full-width Save at the bottom — and were previously two unrelated stylesheets
 * (infantStyles, infantFeddingLogStyles) whose palettes had drifted off-brand (#4338CA,
 * #1F2937). Everything here draws from colors.ts so the Infant surface matches the rest of
 * the app.
 *
 * Screen-specific rules stay in the screen. Only what more than one screen needs lives here.
 */
export const infantLogStyles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.pageBG,
  },

  content: {
    padding: 16,
    // Room for the Save button to clear the gesture bar on tall devices.
    paddingBottom: 40,
  },

  card: {
    backgroundColor: colors.white,
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
    marginTop: 5,
    boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.12)",
  },

  /** The blue rounded label that titles each section. */
  pill: {
    alignSelf: "flex-start",
    backgroundColor: colors.logSectionPill,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },

  pillText: {
    fontSize: 13,
    color: colors.white,
  },

  /** Explanatory line under a section pill. */
  caption: {
    marginTop: 10,
    fontSize: 13,
    lineHeight: 19,
    color: colors.darkGray,
  },

  /** Small print at the bottom of a card — sources, disclaimers, editability windows. */
  footnote: {
    marginTop: 12,
    fontSize: 11,
    lineHeight: 17,
    color: colors.gray,
  },

  /** The strip itself. See the comment at its use site in LogChipTabs. */
  chipStrip: {
    flexGrow: 0,
    flexShrink: 0,
  },

  chipRow: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    // Chips share a height even when one label wraps.
    alignItems: "center",
    gap: 10,
  },

  chip: {
    borderRadius: 22,
    paddingHorizontal: 18,
    paddingVertical: 11,
    backgroundColor: colors.lightPurple,
  },

  chipActive: {
    backgroundColor: colors.darkPurple,
  },

  chipDisabled: {
    backgroundColor: colors.lightGray,
  },

  chipText: {
    fontSize: 14,
    color: colors.purple,
  },

  chipTextActive: {
    color: colors.white,
  },

  chipTextDisabled: {
    color: colors.gray,
  },

  input: {
    flex: 1,
    backgroundColor: colors.logFieldBG,
    borderRadius: 8,
    paddingHorizontal: 12,
    // Vertical padding rather than a fixed height: Hindi glyphs are taller than Latin and
    // were being clipped by the old fixed-height fields.
    paddingVertical: 10,
    fontSize: 14,
    color: colors.black,
  },

  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  /** "+ Add more" affordance under a repeating list of rows. */
  addMore: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 12,
    alignSelf: "flex-start",
  },

  addMoreText: {
    fontSize: 14,
    color: colors.darkPurple,
  },

  banner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: colors.lightPurple,
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
  },

  bannerText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 20,
    color: colors.text,
  },

  /** Grey stat tile — "FEEDS 1", "LONGEST GAP 3h 10m". */
  stat: {
    flex: 1,
    backgroundColor: colors.lightGray,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 10,
  },

  statLabel: {
    fontSize: 10,
    letterSpacing: 0.5,
    color: colors.gray,
  },

  statValue: {
    marginTop: 2,
    fontSize: 16,
    color: colors.black,
  },

  /** Text link under the Save button — the feeding screen's variant switch. */
  linkButton: {
    marginTop: 14,
    alignSelf: "center",
    paddingVertical: 6,
    paddingHorizontal: 12,
  },

  linkText: {
    fontSize: 14,
    color: colors.darkPurple,
  },
});
