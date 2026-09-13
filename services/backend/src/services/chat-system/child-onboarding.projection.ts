/**
 * Projects baby-onboarding answers onto the child subdocument in users.childs[].
 *
 * The mother's equivalent is ChatFlowService.updateOnboardingData, which is a
 * switch(nodeId) writing into user.onboarding_data. This is the same idea for the
 * per-child flow, kept in its own module for two reasons:
 *
 *  - updateOnboardingData loads the whole user document and mutates it. Doing that here
 *    would mean read-modify-write on an array shared by every child, so two concurrent
 *    answers could lose one another. Every write below is a targeted positional $set,
 *    which is atomic on the server and touches only the one child.
 *  - It keeps the mother's projector free of child concerns. The two flows share an
 *    engine, not a schema.
 *
 * Node ids are all `child_` prefixed, so even if this were reached with a mother node it
 * would fall through the switch and no-op rather than corrupt anything.
 */
import { Types } from "mongoose";

import UserModel from "../../models/user.model";
import flowInstanceModel from "../../models/flowInstance.model";
import { IFlowNode } from "../../types/chat.types";
import { EChildOnboardingStatus, ESex, EVaccinationSector } from "../../types/user.types";
import { resolveSelectedValues } from "../../utils/functions/resolveSelectedOptions";
import logger, { createModuleLogger } from "../../utils/logger";

const log = createModuleLogger(logger, "child-onboarding.projection");

export const CHILD_NAME_NODE_ID = "child_name";
export const CHILD_DOB_NODE_ID = "child_dob";
export const CHILD_SEX_NODE_ID = "child_sex";
export const CHILD_VACCINATION_SECTOR_NODE_ID = "child_vaccination_sector";
export const CHILD_HEAD_CIRCUMFERENCE_NODE_ID = "child_birth_head_circumference";
export const CHILD_LENGTH_NODE_ID = "child_birth_length";
export const CHILD_WEIGHT_NODE_ID = "child_birth_weight";

/**
 * Measurement nodes are QUESTION_FREE_TEXT — the engine has no numeric node type — so the
 * text arrives as a string and has to be parsed here. Out-of-range values are dropped
 * rather than stored: the client already range-checks before submitting, so anything
 * landing outside these bounds is a bad payload, and a nonsense birth weight would poison
 * the day-0 point on the growth chart.
 */
const MEASUREMENT_BOUNDS: Record<string, { field: string; min: number; max: number }> = {
    [CHILD_HEAD_CIRCUMFERENCE_NODE_ID]: {
        field: "birth_measurements.head_circumference_cm",
        min: 20,
        max: 60,
    },
    [CHILD_LENGTH_NODE_ID]: { field: "birth_measurements.length_cm", min: 30, max: 100 },
    [CHILD_WEIGHT_NODE_ID]: { field: "birth_measurements.weight_grams", min: 500, max: 8000 },
};

/** Apply a $set to exactly one child subdocument, addressed by its _id. */
const setChildFields = async (
    userId: string,
    childId: Types.ObjectId | string,
    fields: Record<string, unknown>,
): Promise<void> => {
    const prefixed: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(fields)) {
        prefixed[`childs.$.${key}`] = value;
    }

    const result = await UserModel.updateOne(
        { _id: userId, "childs._id": childId },
        { $set: prefixed },
    );

    if (result.matchedCount === 0) {
        // The instance points at a child that no longer exists — deleted mid-flow, most
        // likely. Loud, because the answer is otherwise silently discarded.
        log.error({ userId, childId, fields }, "No matching child subdocument for projection");
    }
};

/**
 * Persist one baby-onboarding answer onto the child.
 *
 * Mirrors the signature of ChatFlowService.updateOnboardingData so the caller can pick
 * between the two on flow slug alone.
 */
export const updateChildOnboardingData = async (
    userId: string,
    childId: Types.ObjectId | string,
    node: IFlowNode,
    selectedKeys?: number[],
    freeText?: string,
    selectedValues?: string[],
): Promise<void> => {
    const nodeId = node.id;
    const selection = { selectedValues, selectedKeys };
    const text = freeText?.trim();

    switch (nodeId) {
        case CHILD_NAME_NODE_ID: {
            if (!text) break;
            await setChildFields(userId, childId, { name: text });

            // Mirrored onto the instance so later questions can interpolate {{child_name}}
            // without re-reading the user document on every question build.
            await flowInstanceModel.updateOne(
                { userId, subjectChildId: childId },
                { $set: { "variables.child_name": text } },
            );
            break;
        }

        case CHILD_DOB_NODE_ID: {
            if (!text) break;
            const dob = new Date(text);
            if (Number.isNaN(dob.getTime())) {
                log.warn({ userId, childId, freeText }, "Unparseable child date of birth");
                break;
            }
            await setChildFields(userId, childId, { date_of_birth: dob });
            break;
        }

        case CHILD_SEX_NODE_ID: {
            const [sex] = resolveSelectedValues(node, selection);
            // The flow offers only Female and Male; ESex.OTHER survives solely for the
            // direct POST /api/v1/child contract and is never reachable from here.
            if (sex === ESex.MALE || sex === ESex.FEMALE) {
                await setChildFields(userId, childId, { sex });
            }
            break;
        }

        case CHILD_VACCINATION_SECTOR_NODE_ID: {
            const [sector] = resolveSelectedValues(node, selection);
            if (
                sector === EVaccinationSector.PUBLIC ||
                sector === EVaccinationSector.PRIVATE
            ) {
                await setChildFields(userId, childId, { vaccination_sector: sector });
            }
            break;
        }

        case CHILD_HEAD_CIRCUMFERENCE_NODE_ID:
        case CHILD_LENGTH_NODE_ID:
        case CHILD_WEIGHT_NODE_ID: {
            const bounds = MEASUREMENT_BOUNDS[nodeId]!;
            const parsed = Number.parseFloat(text ?? "");

            if (!Number.isFinite(parsed) || parsed < bounds.min || parsed > bounds.max) {
                log.warn(
                    { userId, childId, nodeId, freeText },
                    "Discarding out-of-range birth measurement",
                );
                break;
            }

            await setChildFields(userId, childId, { [bounds.field]: parsed });
            break;
        }

        default:
            log.warn({ userId, childId, nodeId }, "No child projection for node");
            break;
    }
};

/** Flip the child out of DRAFT once the last question has been answered. */
export const markChildOnboardingComplete = async (
    userId: string,
    childId: Types.ObjectId | string,
): Promise<void> => {
    await setChildFields(userId, childId, {
        onboarding_status: EChildOnboardingStatus.COMPLETED,
        onboarded_at: new Date(),
    });
};
