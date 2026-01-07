import { IMyProfileData, ISettingsMenu } from "../types/myProfile.types";

export const myProfileData: IMyProfileData = {
  name: "Harsha Tomar",
  email: "harshatomar@gmail.com",
  avatar: require("../public/assets/images/doctors/Dr_Harsha_Tomar.png"),
  age: 29,
  isPremium: true,
};
export const settingsMenu: ISettingsMenu[] = [
  {
    title: "Add Partner",
    icon: "user-round-plus",
    componentName: "AddPartner",
    description: "Invite your partner to share your journey.",
  },
  {
    title: "Settings",
    icon: "cog",
    componentName: "Settings",
    description: "Manage your account and app preferences.",
  },
  {
    title: "Hide content",
    icon: "eye-closed",
    componentName: "HideContent",
    description: "Customize what information is visible.",
  },
  {
    title: "Notifications",
    icon: "bell-ring",
    componentName: "Notifications",
    description: "Stay updated with alerts and reminders.",
  },
  {
    title: "Support",
    icon: "heart-handshake",
    componentName: "Support",
    description: "Get help and reach out to our team.",
  },
  {
    title: "Legal",
    icon: "book-open-text",
    componentName: "Legal",
    description: "View terms of service and privacy policies.",
  },
  {
    title: "Medical",
    icon: "stethoscope",
    componentName: "Medical",
    description: "Access your health records and medical info.",
  },
  {
    title: "About VivaMama",
    icon: "info",
    componentName: "AboutVivaNari",
    description: "Learn more about our mission and the app.",
  },
];
