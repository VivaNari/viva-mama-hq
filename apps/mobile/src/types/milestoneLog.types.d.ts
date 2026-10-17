/**
 * Milestone logs as the API returns them.
 *
 * Keyed on the milestone rather than a calendar day, unlike the growth and diaper logs: a
 * milestone is reached once, and the date is an attribute of it.
 */
export interface IMilestoneLog {
  _id: string;
  childId: string;
  /** A key from the generated MCP catalogue in src/data/infantMilestoneData.ts. */
  milestoneKey: string;
  /** "YYYY-MM-DD", IST. */
  achievedOn: string;
  createdAt: string;
  updatedAt: string;
}
