import { Schema } from "mongoose";

/**
 * One dose of one vaccine a parent has recorded as given.
 *
 * Shaped like the milestone log rather than the growth or diaper log, and for the same
 * reason: this collection is **not** keyed on a calendar day. A dose is given once, the key
 * is the dose, and the date is an attribute of it. So the unique index is on the dose, and
 * there is no closed-day rule — a parent enters the whole card from a clinic visit weeks
 * after the fact, and that is the normal case rather than a correction.
 *
 * The sector a family attends is deliberately **not** stored here. A dose key names the dose
 * and not the schedule it appears on, so BCG at birth is one row whichever sector gave it,
 * and a family that switches keeps the ticks that genuinely carry over. The ones that do not
 * carry over are the ones whose products differ — three doses of Pentavalent are not three
 * of DTwP + Hib + Hepatitis B — and those have different keys already. Mapping between them
 * is a clinical question, not one this schema should answer by guessing.
 */
export interface IVaccinationLog {
    _id: Schema.Types.ObjectId;
    userId: Schema.Types.ObjectId;

    /**
     * Matches `users.childs[]._id`. Deliberately not a Mongoose `ref` — children are
     * embedded subdocuments, so there is no collection to populate from.
     */
    childId: Schema.Types.ObjectId;

    /**
     * A key from the generated schedule (`constants/vaccine-keys.ts`), derived from the
     * India MCP card. Validated on the way in, so a stale client cannot store a row that no
     * screen can render.
     */
    vaccineKey: string;

    /** IST start-of-day. Defaults to today, but a parent may date it earlier. */
    givenOn: Date;

    createdAt: Date;
    updatedAt: Date;
}
