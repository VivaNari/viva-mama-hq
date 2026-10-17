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
   * i18n key for the line under the title, when there is one.
   *
   * Left unset now that every log has a real backend: a placeholder like "Not logged yet"
   * read as boilerplate rather than information on a tile that never had anything else to
   * say. A tile with real data to show (the dashboard's `subtitle` prop) still renders it.
   */
  subtitleKey?: string;
  /** Renders across both columns. Used for the odd tile out so the grid has no gap. */
  fullWidth?: boolean;
}
