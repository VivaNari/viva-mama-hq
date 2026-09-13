/**
 * Resolves which child a baby-onboarding run is about.
 *
 * The awkwardness this solves: the child's name is the FIRST question, so there is no
 * child to attach the run to at the moment the run starts. We therefore create the child
 * up front in DRAFT state and project answers onto it as they arrive. A DRAFT child is
 * filtered out of the dashboard, so an abandoned run never surfaces as a real child.
 */
import { Types } from "mongoose";

import UserModel from "../../models/user.model";
import { EChildOnboardingStatus, IUser } from "../../types/user.types";
import logger, { createModuleLogger } from "../../utils/logger";

const log = createModuleLogger(logger, "child-subject.service");

export interface SubjectChildResult {
    childId: Types.ObjectId;
    created: boolean;
}

/**
 * Resolve (or create) the child that this baby-onboarding run belongs to.
 *
 * Resolution order:
 *  1. An explicit childId — re-running onboarding for a known child.
 *  2. The subject of an in-flight run — resuming after the app was killed mid-flow.
 *  3. A brand new DRAFT child.
 *
 * Step 2 is what stops "Add your baby", abandon, "Add your baby" from littering the user
 * with half-finished drafts: the second entry picks the first one back up.
 */
export const resolveSubjectChild = async (
    user: IUser,
    childId?: string,
): Promise<SubjectChildResult> => {
    const userId = user._id.toString();

    // 1. Explicit child — must actually belong to this user.
    if (childId) {
        if (!Types.ObjectId.isValid(childId)) {
            throw new Error("Invalid childId");
        }

        const owns = (user.childs ?? []).some(
            (child) => child._id?.toString() === childId,
        );

        if (!owns) {
            throw new Error("Child not found for this user");
        }

        return { childId: new Types.ObjectId(childId), created: false };
    }

    // 2. Resume an unfinished run by finding the DRAFT CHILD, not the flow instance.
    //
    // The child is the first thing written — step 3 pushes it, and only then does the
    // caller create the instance. Keying resumption off the instance therefore left two
    // ways to leak a child that nothing could ever reach again:
    //
    //   - instance creation fails after the push, so no instance exists to resume from;
    //   - two starts race, both see no instance yet, and both push a child.
    //
    // Either way the next start found no open run and pushed yet another draft, forever.
    // Matching on the draft child closes both: whatever else happened, the child from the
    // previous attempt is still sitting on the user and gets picked back up.
    const existingDraft = (user.childs ?? []).find(
        (child) => child.onboarding_status === EChildOnboardingStatus.DRAFT && child._id,
    );

    if (existingDraft?._id) {
        log.info(
            { userId, childId: existingDraft._id },
            "Resuming unfinished baby onboarding",
        );
        return { childId: new Types.ObjectId(existingDraft._id.toString()), created: false };
    }

    // 3. New draft child. The _id is generated here rather than read back from the
    // updated document, because $push gives no reliable way to identify which element
    // was just appended when two adds race.
    const newChildId = new Types.ObjectId();

    await UserModel.updateOne(
        { _id: user._id },
        {
            $push: {
                childs: {
                    _id: newChildId,
                    onboarding_status: EChildOnboardingStatus.DRAFT,
                },
            },
        },
    );

    log.info({ userId, childId: newChildId }, "Created draft child for baby onboarding");

    return { childId: newChildId, created: true };
};
