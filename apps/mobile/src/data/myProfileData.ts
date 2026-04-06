import { ISettingsMenu } from "../types/myProfile.types";

export const settingsMenu: ISettingsMenu[] = [
  {
    title: "Add Partner",
    icon: "user-round-plus",
    componentName: "AddPartner",
    description: "Invite your partner to share your journey.",
  },
  {
    title: "Notifications",
    icon: "bell-ring",
    componentName: "Notifications",
    description: "Stay updated with alerts and reminders.",
  },
  {
    title: "Settings",
    icon: "cog",
    componentName: "Settings",
    description: "Manage your account and app preferences.",
  },
  {
    title: "Privacy Policy",
    icon: "book-open-text",
    componentName: "PrivacyPolicy",
    description: "View terms of service and privacy policies.",
  },
  {
    title: "Terms of Use",
    icon: "book-open-text",
    componentName: "TermsOfUse",
    description: "View terms of service and privacy policies.",
  },
  {
    title: "Support",
    icon: "heart-handshake",
    componentName: "Support",
    description: "Get help and reach out to our team.",
  },
  {
    title: "About VivaMama",
    icon: "info",
    componentName: "AboutVivaMama",
    description: "Learn more about our mission and the app.",
  },
];
