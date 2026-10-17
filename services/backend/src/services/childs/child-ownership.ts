import { Types } from "mongoose";

import UserModel from "../../models/user.model";
import { IChild } from "../../types/user.types";

/**
 * "Does this child belong to this user?" — asked once, in one place.
 *
 * Children are embedded in `users.childs[]`, so ownership is a filter rather than a join.
 * Every per-child collection (growth logs, diaper logs) has to ask the same question before
 * it reads or writes, and getting the filter subtly wrong in one copy is how one user ends
 * up addressing another user's child by id. So it lives here rather than being reimplemented
 * per service.
 */

export class ChildNotFoundError extends Error {
    constructor(message = "Child not found for this user") {
        super(message);
        this.name = "ChildNotFoundError";
    }
}

/**
 * The child, verified to belong to this user.
 *
 * `{_id: userId, "childs._id": childId}` with a positional projection: both halves matter.
 * Matching on the user alone and filtering in JS would still read the whole array; matching
 * on the child alone would find it under any owner.
 */
export const getOwnedChild = async (userId: string, childId: string): Promise<IChild> => {
    if (!Types.ObjectId.isValid(childId)) throw new ChildNotFoundError();

    const user = await UserModel.findOne(
        { _id: userId, "childs._id": new Types.ObjectId(childId) },
        { "childs.$": 1 },
    ).lean();

    const child = user?.childs?.[0];
    if (!child) throw new ChildNotFoundError();

    return child as IChild;
};
