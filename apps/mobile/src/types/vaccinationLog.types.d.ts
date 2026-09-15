/**
 * Vaccination logs as the API returns them.
 *
 * Keyed on the dose rather than a calendar day, like the milestone log and unlike the growth
 * and diaper ones: a dose is given once, and the date is an attribute of it.
 */
export interface IVaccinationLog {
  _id: string;
  childId: string;
  /** A key from the generated schedule in src/data/infantVaccinationData.ts. */
  vaccineKey: string;
  /** "YYYY-MM-DD", IST. */
  givenOn: string;
  createdAt: string;
  updatedAt: string;
}
