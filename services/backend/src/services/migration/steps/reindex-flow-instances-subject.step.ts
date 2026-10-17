/**
 * Migration step: reindex-flow-instances-subject.step.ts
 *
 * Replaces the unique index on flow_instances:
 *
 *   { userId, flowSlug, postpartumWeek }  ->  { userId, flowSlug, postpartumWeek, subjectChildId }
 *
 * Why: baby-onboarding-v1 runs once per CHILD. A mother with two children legitimately
 * needs two instances of the same slug, which the three-field key forbade — the second
 * "Add your baby" would have failed on a duplicate-key error.
 *
 * Every mother flow writes subjectChildId: null, so their uniqueness guarantee is exactly
 * what it was. The guarantee itself still matters: the week job's check-then-create is a
 * race and Cloud Scheduler retries on a 500.
 *
 * Mongoose never drops a superseded index on its own, so this has to be explicit.
 * Idempotent: it inspects the live index list first, and the backfill is a no-op once
 * every document has the field.
 *
 * IMPORTANT — the three-field index may never have existed.
 *
 * It is declared on the schema, but Mongoose only builds indexes when autoIndex is on,
 * and at least one environment has the collection with no unique index at all. Where that
 * is true the guarantee was never enforced and duplicate rows have accumulated, so
 * creating a unique index now fails with a raw E11000 naming a single arbitrary document.
 *
 * That is close to useless for an operator, so this step runs a preflight aggregation
 * first and aborts with the complete list of conflicts before touching any index. The
 * duplicates are real user data — resolving them is a deliberate decision about which
 * check-in to keep, not something a migration should guess at.
 */
import flowInstanceModel from "../../../models/flowInstance.model";

const OLD_INDEX_NAME = "userId_1_flowSlug_1_postpartumWeek_1";
const NEW_INDEX_NAME = "userId_1_flowSlug_1_postpartumWeek_1_subjectChildId_1";

interface DuplicateGroup {
    userId: string;
    flowSlug: string;
    postpartumWeek: number;
    count: number;
    instanceIds: string[];
    states: string[];
}

/**
 * Rows that would violate the unique index we are about to build.
 *
 * Grouped on the full key including subjectChildId, so a user legitimately holding one
 * baby-onboarding run per child is not reported.
 */
export async function findConflicts(): Promise<DuplicateGroup[]> {
    const rows = await flowInstanceModel.collection
        .aggregate([
            {
                $group: {
                    _id: {
                        userId: "$userId",
                        flowSlug: "$flowSlug",
                        postpartumWeek: "$postpartumWeek",
                        subjectChildId: "$subjectChildId",
                    },
                    count: { $sum: 1 },
                    instanceIds: { $push: "$_id" },
                    states: { $push: "$state" },
                },
            },
            { $match: { count: { $gt: 1 } } },
        ])
        .toArray();

    return rows.map((row: any) => ({
        userId: String(row._id.userId),
        flowSlug: String(row._id.flowSlug),
        postpartumWeek: row._id.postpartumWeek,
        count: row.count,
        instanceIds: row.instanceIds.map((id: unknown) => String(id)),
        states: row.states,
    }));
}

export async function migrate(): Promise<{
    backfilled: number;
    droppedOldIndex: boolean;
    createdNewIndex: boolean;
}> {
    console.log("Reindexing flow_instances for per-child flows...");

    const collection = flowInstanceModel.collection;

    // 1. Backfill FIRST. A unique index including a field that is missing on existing
    //    documents would treat them all as null anyway, but making it explicit keeps the
    //    index build predictable and the documents self-describing.
    const backfill = await collection.updateMany(
        { subjectChildId: { $exists: false } },
        { $set: { subjectChildId: null } },
    );
    console.log(`Backfilled subjectChildId on ${backfill.modifiedCount} instance(s).`);

    const indexes = await collection.indexes();
    const hasOld = indexes.some((index) => index.name === OLD_INDEX_NAME);
    const hasNew = indexes.some((index) => index.name === NEW_INDEX_NAME);

    // 1b. Preflight. Only worth doing when the index is not already in place — if it is,
    // the database has been enforcing uniqueness and there is nothing to find.
    if (!hasNew) {
        const conflicts = await findConflicts();

        if (conflicts.length > 0) {
            console.error(
                `Cannot build ${NEW_INDEX_NAME}: ${conflicts.length} duplicate group(s) already violate it.`,
            );
            console.error(
                "These rows predate any enforced unique index. Each group needs a decision " +
                    "about which instance to keep — they carry real check-in history, so this " +
                    "step will not delete them.",
            );

            for (const conflict of conflicts) {
                console.error(
                    `  user=${conflict.userId} slug=${conflict.flowSlug} week=${conflict.postpartumWeek} ` +
                        `count=${conflict.count} states=[${conflict.states.join(", ")}] ` +
                        `ids=[${conflict.instanceIds.join(", ")}]`,
                );
            }

            throw new Error(
                `flow_instances has ${conflicts.length} duplicate group(s) blocking the unique index; resolve them and re-run.`,
            );
        }
    }

    // 2. Create the new index BEFORE dropping the old one, so the collection is never
    //    left without a uniqueness guard. The old index is a strict superset constraint,
    //    so both can coexist for the moment in between.
    let createdNewIndex = false;
    if (!hasNew) {
        await collection.createIndex(
            { userId: 1, flowSlug: 1, postpartumWeek: 1, subjectChildId: 1 },
            { unique: true, name: NEW_INDEX_NAME },
        );
        createdNewIndex = true;
        console.log(`Created ${NEW_INDEX_NAME}.`);
    } else {
        console.log(`${NEW_INDEX_NAME} already present.`);
    }

    // 3. Drop the old one. Until this happens a second child still cannot be added.
    let droppedOldIndex = false;
    if (hasOld) {
        await collection.dropIndex(OLD_INDEX_NAME);
        droppedOldIndex = true;
        console.log(`Dropped ${OLD_INDEX_NAME}.`);
    } else {
        console.log(`${OLD_INDEX_NAME} not present — nothing to drop.`);
    }

    return {
        backfilled: backfill.modifiedCount,
        droppedOldIndex,
        createdNewIndex,
    };
}
