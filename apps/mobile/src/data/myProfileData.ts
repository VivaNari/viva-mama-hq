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
    title: "Settings",
    icon: "cog-outline",
    componentName: "Settings",
  },
  {
    title: "Hide content",
    icon: "eye-off-outline",
    componentName: "HideContent",
  },
  {
    title: "Notifications",
    icon: "bell-outline",
    componentName: "Notifications",
  },
  {
    title: "Support",
    icon: "heart-plus-outline",
    componentName: "Support",
  },
  {
    title: "Legal",
    icon: "book-open-outline",
    componentName: "Legal",
  },
  {
    title: "Medical",
    icon: "stethoscope",
    componentName: "Medical",
  },
  {
    title: "About VivaMama",
    icon: "alert-circle-outline",
    componentName: "AboutVivaNari",
  },
];
