/**
 * Migration step: backfill-baby-reminder-fields.step.ts
 *
 * Sets `pending_vaccination_reminders` and `pending_milestone_reminders` to `[]` on every
 * `users.childs[]` entry that predates the daily age-reminder job.
 *
 * Why this needs a migration at all: `childSchema` gives both fields `default: []`, but a
 * Mongoose default only applies when a document is *constructed* — a child already
 * persisted without these keys is read back exactly as stored, key and all, on every
 * future read. Without this step the age-reminder job's first read of an old child would
 * see `undefined` where it expects an array, rather than the empty array a brand-new child
 * gets for free.
 *
 * Two independent array filters rather than one, so a child missing only one of the two
 * fields (unlikely, but not impossible if the two ship in separate deploys) still gets
 * exactly the one it needs and nothing rewritten unnecessarily on the other.
 *
 * Idempotent by construction: the filter on each field is `{ $exists: false }`, so a
 * second run matches nothing and touches nothing.
 */
import UserModel from "../../../models/user.model";

export interface BackfillBabyReminderFieldsResult {
    /** Users with at least one child backfilled. */
    usersUpdated: number;
}

export async function migrate(): Promise<BackfillBabyReminderFieldsResult> {
    const result = await UserModel.updateMany(
        {
            $or: [
                { "childs.pending_vaccination_reminders": { $exists: false } },
                { "childs.pending_milestone_reminders": { $exists: false } },
            ],
        },
        {
            $set: {
                "childs.$[missingVaccinationReminders].pending_vaccination_reminders": [],
                "childs.$[missingMilestoneReminders].pending_milestone_reminders": [],
            },
        },
        {
            arrayFilters: [
                { "missingVaccinationReminders.pending_vaccination_reminders": { $exists: false } },
                { "missingMilestoneReminders.pending_milestone_reminders": { $exists: false } },
            ],
        },
    );

    const usersUpdated = result.modifiedCount ?? 0;
    console.log(`backfill-baby-reminder-fields: ${usersUpdated} user(s) backfilled`);
    return { usersUpdated };
}
