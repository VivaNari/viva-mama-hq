import vaccinationLogModel from "../../models/vaccination-log.model";
import { IVaccinationLog } from "../../types/vaccination-log.types";
import BaseService from "../base.service";
import { ChildNotFoundError, getOwnedChild } from "../childs/child-ownership";

/** Re-exported for the controller and tests that import it from here. */
export { ChildNotFoundError };

export interface RecordDoseParams {
    userId: string;
    childId: string;
    vaccineKey: string;
    /** IST start-of-day. */
    givenOn: Date;
}

class VaccinationLogService extends BaseService<IVaccinationLog> {
    constructor() {
        super(vaccinationLogModel);
    }

    /** The child, verified to belong to this user. */
    getOwnedChild = (userId: string, childId: string) => getOwnedChild(userId, childId);

    /**
     * Record a dose as given.
     *
     * An upsert on (user, child, dose), so recording the same dose twice corrects the date
     * rather than throwing on the unique index. Re-recording is how a parent fixes a date
     * they got wrong, not an error.
     */
    record = async ({
        userId,
        childId,
        vaccineKey,
        givenOn,
    }: RecordDoseParams): Promise<IVaccinationLog> => {
        await getOwnedChild(userId, childId);

        const document = await vaccinationLogModel.findOneAndUpdate(
            { userId, childId, vaccineKey },
            {
                $set: { givenOn },
                $setOnInsert: { userId, childId, vaccineKey },
            },
            { upsert: true, new: true, setDefaultsOnInsert: true },
        );

        return document as IVaccinationLog;
    };

    /**
     * Un-record a dose.
     *
     * Always available. A parent ticking down a card at the clinic will mis-tap, and this
     * screen offers no other undo.
     */
    remove = async ({
        userId,
        childId,
        vaccineKey,
    }: {
        userId: string;
        childId: string;
        vaccineKey: string;
    }): Promise<boolean> => {
        await getOwnedChild(userId, childId);

        const result = await vaccinationLogModel.deleteOne({ userId, childId, vaccineKey });
        return result.deletedCount > 0;
    };

    /**
     * Everything recorded for a child, oldest first.
     *
     * The whole schedule at once rather than a visit at a time: it is 48 rows at the very
     * most, and the screen has to count what is done per visit to label its chips anyway.
     */
    listForChild = async (userId: string, childId: string): Promise<IVaccinationLog[]> => {
        await getOwnedChild(userId, childId);

        return vaccinationLogModel
            .find({ userId, childId })
            .sort({ givenOn: 1 })
            .lean<IVaccinationLog[]>();
    };

    /** Every vaccination log for one child. Used when a child is removed from a user. */
    deleteForChild = async (userId: string, childId: string): Promise<number> => {
        const result = await vaccinationLogModel.deleteMany({ userId, childId });
        return result.deletedCount ?? 0;
    };
}

export default VaccinationLogService;
