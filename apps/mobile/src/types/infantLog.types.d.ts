/**
 * Types for the five infant log screens.
 *
 * Nothing here is persisted yet — every log screen holds its entries in component state
 * and loses them on unmount. The shapes are written as if they were the API payload so
 * that wiring a backend later is a swap of the state hook, not a rewrite of the screen.
 */

/**
 * What the dashboard tiles hand to a log screen.
 *
 * The screens interpolate the child's name ("Has Aarav been vaccinated with:") and pick a
 * variant from the age ("6 months+"), so they need the selected child rather than
 * re-deriving one. `childId` is carried unused by the UI today; it is the key the log
 * collections will be written against.
 */
export interface InfantLogRouteParams {
  childId?: string;
  childName?: string;
  /** ISO string — route params must stay serialisable for deep links and state restore. */
  childDob?: string;
  /**
   * Needed to score against WHO's tables, which are published per sex. "Other" and absent
   * are both valid here; the standards package reports NOT_APPLICABLE rather than guessing.
   */
  childSex?: "Male" | "Female" | "Other";
  vaccinationSector?: "public" | "private";
}

/* ---------------------------------- Growth ---------------------------------- */

export interface IGrowthMeasurementField {
  key: "head_circumference_cm" | "length_cm" | "weight_grams";
  labelKey: string;
  unitKey: string;
  placeholder: string;
}

/* --------------------------------- Feeding ---------------------------------- */

export type TFeedingType = "exclusive_breastfeeding" | "formula" | "mixed";

export type TFeedSide = "left" | "right" | "bottle";

export interface IFeedEntry {
  /** "HH:MM", free text — a real time picker lands with the backend. */
  time: string;
  side: TFeedSide | null;
  /** Minutes on the breast, or millilitres in the bottle, depending on `side`. */
  amount: string;
}

export interface ISolidEntry {
  time: string;
  food: string;
}

export interface IFeedingTypeOption {
  key: TFeedingType;
  labelKey: string;
  descriptionKey: string;
}

/* ---------------------------------- Diaper ---------------------------------- */

export type TDiaperKind = "wet" | "dirty" | "both";

export interface IDiaperEntry {
  id: string;
  kind: TDiaperKind;
  /** Epoch millis — formatted for display, kept sortable in state. */
  loggedAt: number;
}

export interface IDiaperKindConfig {
  kind: TDiaperKind;
  labelKey: string;
  descriptionKey: string;
  icon: string;
  background: string;
  foreground: string;
}

/* ------------------------------- Vaccination -------------------------------- */

export type TVaccinationSector = "public" | "private";

export interface IVaccine {
  /** Brand-neutral vaccine code (BCG, OPV-0). Not translated — these are proper nouns. */
  name: string;
  /** i18n key for the line under the name. */
  descriptionKey?: string;
}

export interface IVaccinationVisit {
  key: string;
  labelKey: string;
  vaccines: IVaccine[];
}

/** Which vaccines of a visit are marked given, keyed by vaccine name. */
export type TVaccinationSelection = Record<string, boolean>;

/* -------------------------------- Milestone --------------------------------- */

/**
 * Milestones and their matching warning signs, as printed on the India MCP card (2018).
 *
 * Both lists hold keys, not text. The words live in the locale files under
 * `infant.milestone.items.<key>` and `infant.milestone.warnings.<key>` so Hindi can be a
 * translation rather than a second transcription of a government publication.
 *
 * The card gives one age range per band rather than per milestone, so a card shows its
 * band's range — the old per-milestone `ageKey` had no source and is gone, along with
 * `photoHintKey`, whose hatched placeholder the rig illustration replaces.
 */
export interface IMilestoneBand {
  key: string;
  labelKey: string;
  /** Milestone keys, in card order. */
  milestones: string[];
  /** Warning-sign keys for the same band, in card order. */
  warnings: string[];
}
