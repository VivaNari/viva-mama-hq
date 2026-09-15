/**
 * Types for the five infant log screens.
 *
 * The shapes that describe *content* live here — schedules, catalogues, the options a
 * screen offers. What a parent actually logged is a server row and is typed next to its
 * API client instead (`growthLog.types`, `diaperLog.types`, `milestoneLog.types`,
 * `vaccinationLog.types`). Feeding is the one screen still holding its entries in
 * component state and losing them on unmount.
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

/**
 * How the card writes a dose, as a kind rather than the printed string.
 *
 * The card says the same thing five ways — "Single dose", "0 (birth dose)", "Birth dose",
 * a bare number, "Booster-1" — and the generator collapses those into these four so the
 * label can be translated and the key can be stable. "1st dose" and "1" are the same dose.
 */
export type TVaccineDoseKind = "single" | "birth" | "number" | "booster";

export interface IVaccineDose {
  /**
   * Stable key from the generated schedule, and the primary key in the database.
   *
   * It names the *dose*, not the schedule it appears on: BCG at birth reaches the same key
   * from both sectors, so a family that switches keeps the ticks that genuinely carry over.
   */
  key: string;
  /** The vaccine as printed on the card. A proper noun — never translated. */
  name: string;
  doseKind: TVaccineDoseKind;
  /** Which dose, where the card numbers them. Absent for "Single dose" and a bare booster. */
  doseNumber?: number;
  /** Whether `infant.vaccination.notes.<key>` exists — an absent note is not a missing one. */
  note?: boolean;
  /** Vitamin A is recorded in the immunisation section but is not a vaccine, and says so. */
  supplement?: boolean;
}

/**
 * When a visit falls due, as an offset from the date of birth.
 *
 * Weeks and months rather than a day count, because months are calendar months: the 16–24
 * month window has to land on the same day of the month as the birthday.
 */
export interface IVaccinationDue {
  unit: "week" | "month";
  from: number;
  to: number;
}

export interface IVaccinationVisit {
  key: string;
  /** Short, for the chip: "6 weeks". */
  labelKey: string;
  /** The card's parenthetical, where it has one: "1½ months". */
  detailKey?: string;
  due: IVaccinationDue;
  doses: IVaccineDose[];
}

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
