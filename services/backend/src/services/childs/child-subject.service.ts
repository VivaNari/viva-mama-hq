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
import flowInstanceModel from "../../models/flowInstance.model";
import { BABY_ONBOARDING_SLUG } from "../../constants/chat";
import { FlowInstanceStateEnum } from "../../types/chat.types";
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

    // 2. Resume an in-flight run.
    const openRun = await flowInstanceModel
        .findOne({
            userId: user._id,
            flowSlug: BABY_ONBOARDING_SLUG,
            state: { $in: [FlowInstanceStateEnum.ACTIVE, FlowInstanceStateEnum.PENDING] },
            subjectChildId: { $ne: null },
        })
        .select("subjectChildId")
        .sort({ createdAt: -1 })
        .lean();

    if (openRun?.subjectChildId) {
        const stillDraft = (user.childs ?? []).some(
            (child) =>
                child._id?.toString() === openRun.subjectChildId!.toString() &&
                child.onboarding_status !== EChildOnboardingStatus.COMPLETED,
        );

        if (stillDraft) {
            log.info(
                { userId, childId: openRun.subjectChildId },
                "Resuming in-flight baby onboarding",
            );
            return { childId: new Types.ObjectId(openRun.subjectChildId.toString()), created: false };
        }
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
