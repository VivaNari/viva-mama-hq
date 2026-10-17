import { ISettingsMenu } from "../types/myProfile.types";

export const settingsMenu: ISettingsMenu[] = [
  // {
  //   titleKey: "menu.addPartner",
  //   icon: "user-round-plus",
  //   componentName: "AddPartner",
  //   descriptionKey: "menu.addPartnerDesc",
  // },
  // {
  //   titleKey: "menu.notifications",
  //   icon: "bell-ring",
  //   componentName: "Notifications",
  //   descriptionKey: "menu.notificationsDesc",
  // },
  // {
  //   titleKey: "menu.settings",
  //   icon: "cog",
  //   componentName: "Settings",
  //   descriptionKey: "menu.settingsDesc",
  // },
  {
    titleKey: "menu.myConsultations",
    icon: "calendar-clock",
    componentName: "MyConsultations",
    descriptionKey: "menu.myConsultationsDesc",
  },
  // Required by Play's Subscriptions policy: an app selling a subscription must offer an
  // in-app way to manage and cancel it from account settings. The named violation is its
  // absence, so this row has to be findable without hunting — hence near the top, rather
  // than buried among the policy links.
  {
    titleKey: "menu.mySubscription",
    icon: "credit-card",
    componentName: "MySubscription",
    descriptionKey: "menu.mySubscriptionDesc",
  },
  {
    titleKey: "menu.language",
    icon: "languages",
    componentName: "",
    action: "CHANGE_LANGUAGE",
    descriptionKey: "menu.languageDesc",
  },
  {
    titleKey: "menu.privacyPolicy",
    icon: "book-open-text",
    componentName: "https://vivamama.in/privacy-policy/",
    descriptionKey: "menu.privacyPolicyDesc",
  },
  {
    titleKey: "menu.termsOfUse",
    icon: "book-open-text",
    componentName: "https://vivamama.in/terms-and-conditions/",
    descriptionKey: "menu.termsOfUseDesc",
  },
  {
    titleKey: "menu.support",
    icon: "heart-handshake",
    componentName: "Support",
    descriptionKey: "menu.supportDesc",
  },
  {
    titleKey: "menu.aboutVivaMama",
    icon: "info",
    componentName: "AboutVivaMama",
    descriptionKey: "menu.aboutVivaMamaDesc",
  },
  // Required by Play's User Data policy: an in-app path to delete the account and its
  // data. Last in the list and styled destructively so it cannot be hit by accident
  // while reaching for the row above it.
  {
    titleKey: "menu.deleteAccount",
    icon: "trash-2",
    componentName: "",
    action: "DELETE_ACCOUNT",
    descriptionKey: "menu.deleteAccountDesc",
    destructive: true,
  },
];
