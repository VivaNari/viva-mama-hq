import { StyleSheet } from "react-native";
import { colors } from "../assets/colors";

export const vivaAiHubStyles = StyleSheet.create({
  header: {
    paddingTop: 20,
    paddingBottom: 14,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.vivaDivider,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.darkPurple,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 16,
    color: colors.darkPurple,
  },
  subtitle: {
    fontSize: 11.5,
    color: colors.vivaMuted,
  },
  content: {
    paddingHorizontal: 20,
    paddingVertical: 18,
    gap: 16,
  },
  hero: {
    borderRadius: 22,
    paddingVertical: 22,
    paddingHorizontal: 20,
    gap: 14,
    backgroundColor: colors.darkPurple,
  },
  heroTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  heroIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.vivaHeroIcon,
    alignItems: "center",
    justifyContent: "center",
  },
  heroTitle: {
    flex: 1,
    fontSize: 20,
    lineHeight: 28,
    color: colors.white,
  },
  heroBody: {
    fontSize: 13,
    lineHeight: 19,
    color: colors.vivaHeroText,
  },
  askBar: {
    backgroundColor: colors.vivaHeroGlass,
    borderRadius: 999,
    paddingVertical: 6,
    paddingRight: 6,
    paddingLeft: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  askText: {
    flex: 1,
    fontSize: 13,
    color: colors.vivaHeroText,
  },
  askTextListening: {
    color: colors.white,
  },
  micButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
  },
  micButtonListening: {
    borderWidth: 3,
    borderColor: colors.vivaHeroRing,
  },
  sectionLabel: {
    fontSize: 12,
    color: colors.vivaLabel,
    marginTop: -6,
  },
});
