export interface IMyProfileData {
  name: string;
  email: string;
  avatar: number;
  age: number;
  isPremium: boolean;
}

export interface ISettingsMenu {
  /** i18n key for the menu title, e.g. "menu.addPartner". */
  titleKey: string;
  /** i18n key for the menu description. */
  descriptionKey: string;
  icon: string;
  /** Screen name to navigate to, or a full http(s) URL to open. */
  componentName: string;
  /** Optional inline action handled by the screen instead of navigation. */
  action?: "CHANGE_LANGUAGE" | "DELETE_ACCOUNT";
  /** Renders the row in the destructive colour. Used by account deletion. */
  destructive?: boolean;
}
