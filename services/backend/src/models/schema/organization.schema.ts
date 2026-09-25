import { Schema } from "mongoose";
import { generalSchemaOptions } from "../../constants/model";
import { IOrganization } from "../../types/referral.types";

/**
 * A referring organization — a hospital, clinic chain or employer that strikes a deal
 * with us rather than an individual doctor.
 *
 * Deliberately carries NO seat data. Seats belong to a deal, a deal is a referral code,
 * and one organization may run two campaigns with different plans and different pools.
 * Putting the counter here would force them to share one.
 */
const organizationSchema = new Schema<IOrganization>(
    {
        name: { type: String, required: true, trim: true },
        // The stable handle ops quote in a contract; the display name may be edited.
        slug: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
        },
        contactEmail: { type: String, default: null, lowercase: true, trim: true },
        contactPhone: { type: String, default: null, trim: true },
        notes: { type: String, default: null },
        // Never deleted — deleting orphans its programs and their redemptions.
        isActive: { type: Boolean, default: true },
    },
    generalSchemaOptions,
);

organizationSchema.index({ isActive: 1 });

export default organizationSchema;
