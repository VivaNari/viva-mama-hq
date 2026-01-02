import { StyleSheet } from "react-native";
import { colors } from "../assets/colors";

export const landingStyles = StyleSheet.create({
  welcomeText: {
    fontSize: 35,
    textAlign: "center",
    color: colors.darkPurple,
    // textShadowColor: 'rgba(0, 0, 0, 0.25)',
    // textShadowOffset: { width: -1, height: 1 },
    // textShadowRadius: 10,
  },
  welcomeCaption: {
    fontWeight: 400,
    fontSize: 16,
    textAlign: "center",
    color: colors.purple,
    marginTop: 10,
  },
});
