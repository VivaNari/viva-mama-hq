import milestoneLogModel from "../../models/milestone-log.model";
import { IMilestoneLog } from "../../types/milestone-log.types";
import BaseService from "../base.service";
import { ChildNotFoundError, getOwnedChild } from "../childs/child-ownership";

/** Re-exported for the controller and tests that import it from here. */
export { ChildNotFoundError };

export interface AchieveMilestoneParams {
    userId: string;
    childId: string;
    milestoneKey: string;
    /** IST start-of-day. */
    achievedOn: Date;
}

class MilestoneLogService extends BaseService<IMilestoneLog> {
    constructor() {
        super(milestoneLogModel);
    }

    /** The child, verified to belong to this user. */
    getOwnedChild = (userId: string, childId: string) => getOwnedChild(userId, childId);

    /**
     * Mark a milestone reached.
     *
     * An upsert on (user, child, milestone), so logging the same milestone twice corrects
     * the date rather than throwing on the unique index. Re-logging is how a parent fixes a
     * date they got wrong, not an error.
     */
    achieve = async ({
        userId,
        childId,
        milestoneKey,
        achievedOn,
    }: AchieveMilestoneParams): Promise<IMilestoneLog> => {
        await getOwnedChild(userId, childId);

        const document = await milestoneLogModel.findOneAndUpdate(
            { userId, childId, milestoneKey },
            {
                $set: { achievedOn },
                $setOnInsert: { userId, childId, milestoneKey },
            },
            { upsert: true, new: true, setDefaultsOnInsert: true },
        );

        return document as IMilestoneLog;
    };

    /**
     * Un-log a milestone.
     *
     * Always available. A parent who taps the wrong card at 3am needs a way back, and this
     * screen offers no other undo.
     */
    forget = async ({
        userId,
        childId,
        milestoneKey,
    }: {
        userId: string;
        childId: string;
        milestoneKey: string;
    }): Promise<boolean> => {
        await getOwnedChild(userId, childId);

        const result = await milestoneLogModel.deleteOne({ userId, childId, milestoneKey });
        return result.deletedCount > 0;
    };

    /** Everything logged for a child, oldest first. */
    listForChild = async (userId: string, childId: string): Promise<IMilestoneLog[]> => {
        await getOwnedChild(userId, childId);

        return milestoneLogModel
            .find({ userId, childId })
            .sort({ achievedOn: 1 })
            .lean<IMilestoneLog[]>();
    };

    /** Every milestone log for one child. Used when a child is removed from a user. */
    deleteForChild = async (userId: string, childId: string): Promise<number> => {
        const result = await milestoneLogModel.deleteMany({ userId, childId });
        return result.deletedCount ?? 0;
    };
}

export default MilestoneLogService;
