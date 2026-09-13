export interface IInfantData {
  checkinOptions: IInfantCheckinOptions[];
}

export interface IInfantCheckinOptions {
  /** i18n key, not display text — resolved with t() at the render site. */
  titleKey: string;
  screen: string;
  /** MaterialDesignIcons glyph name shown above the title. */
  icon: string;
  /**
   * i18n key for the line under the title.
   *
   * Deliberately a static placeholder for now. The designs show live counts here
   * ("5 today", "due in 3 days"), but none of the five log backends exist yet, so a real
   * number would be fabricated. Swap these for computed values as each log lands.
   */
  subtitleKey: string;
  /** Renders across both columns. Used for the odd tile out so the grid has no gap. */
  fullWidth?: boolean;
}
