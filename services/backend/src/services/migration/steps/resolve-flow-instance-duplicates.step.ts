/**
 * Migration step: resolve-flow-instance-duplicates.step.ts
 *
 * Removes rows that stop flow_instances from taking its unique index.
 *
 * How they got there: the schema has always declared
 * `{ userId, flowSlug, postpartumWeek }` unique, but Mongoose only builds indexes when
 * autoIndex is on, and in at least one environment the collection has no unique index at
 * all. Nothing was enforcing the rule, so duplicate rows accumulated — two check-ins for
 * the same user, flow and week.
 *
 * reindex-flow-instances-subject cannot widen that index while they exist, because
 * MongoDB refuses to build a unique index over data that already violates it.
 *
 * DRY RUN BY DEFAULT. This step deletes user data, and it is registered in the run-all
 * STEPS list, which is reachable over HTTP. Automatic deletion on a scheduled job is not
 * a risk worth taking, so run-all only ever reports; removing anything takes a deliberate
 * `--apply` on the CLI.
 *
 * Which row survives: the one with the most answers recorded, because that is the run the
 * user actually did. Ties go to the oldest, since the later row is the accidental repeat.
 * An abandoned restart has few or no answers and loses to the real check-in beside it.
 */
import { Types } from "mongoose";

import flowInstanceModel from "../../../models/flowInstance.model";
import flowResponseModel from "../../../models/flowResponse.model";
import messageModel from "../../../models/message.model";

export interface DuplicateResolution {
    userId: string;
    flowSlug: string;
    postpartumWeek: number;
    keptId: string;
    keptAnswers: number;
    removed: Array<{ id: string; answers: number; state: string }>;
}

export interface ResolveDuplicatesResult {
    applied: boolean;
    groups: number;
    instancesRemoved: number;
    responsesRemoved: number;
    messagesRemoved: number;
    resolutions: DuplicateResolution[];
}

export async function migrate(
    options: { apply?: boolean } = {},
): Promise<ResolveDuplicatesResult> {
    const apply = options.apply === true;

    console.log(
        apply
            ? "Resolving duplicate flow_instances (APPLY — rows will be deleted)..."
            : "Resolving duplicate flow_instances (DRY RUN — nothing will be deleted)...",
    );

    const groups = await flowInstanceModel.collection
        .aggregate([
            {
                $group: {
                    _id: {
                        userId: "$userId",
                        flowSlug: "$flowSlug",
                        postpartumWeek: "$postpartumWeek",
                        subjectChildId: "$subjectChildId",
                    },
                    ids: { $push: "$_id" },
                    count: { $sum: 1 },
                },
            },
            { $match: { count: { $gt: 1 } } },
        ])
        .toArray();

    if (groups.length === 0) {
        console.log("No duplicate flow_instances found.");
        return {
            applied: apply,
            groups: 0,
            instancesRemoved: 0,
            responsesRemoved: 0,
            messagesRemoved: 0,
            resolutions: [],
        };
    }

    const resolutions: DuplicateResolution[] = [];
    const doomed: Types.ObjectId[] = [];

    for (const group of groups) {
        // Score each row by how much of the questionnaire it actually holds.
        const scored = [];
        for (const id of group.ids as Types.ObjectId[]) {
            const instance = await flowInstanceModel.findById(id).lean();
            const answers = await flowResponseModel.countDocuments({ flowInstanceId: id });
            scored.push({
                id,
                answers,
                state: String(instance?.state ?? "UNKNOWN"),
                createdAt: (instance as any)?.createdAt ?? new Date(0),
            });
        }

        scored.sort((a, b) => {
            if (b.answers !== a.answers) return b.answers - a.answers;
            return a.createdAt.getTime() - b.createdAt.getTime();
        });

        const [keep, ...remove] = scored;

        resolutions.push({
            userId: String(group._id.userId),
            flowSlug: String(group._id.flowSlug),
            postpartumWeek: group._id.postpartumWeek,
            keptId: String(keep!.id),
            keptAnswers: keep!.answers,
            removed: remove.map((r) => ({
                id: String(r.id),
                answers: r.answers,
                state: r.state,
            })),
        });

        doomed.push(...remove.map((r) => r.id));
    }

    for (const r of resolutions) {
        console.log(
            `  user=${r.userId} slug=${r.flowSlug} week=${r.postpartumWeek} ` +
                `KEEP ${r.keptId} (${r.keptAnswers} answers) ` +
                `REMOVE ${r.removed
                    .map((x) => `${x.id} (${x.answers} answers, ${x.state})`)
                    .join(", ")}`,
        );
    }

    if (!apply) {
        console.log(
            `\nDRY RUN: ${doomed.length} instance(s) would be removed. Re-run with --apply to delete.`,
        );
        return {
            applied: false,
            groups: groups.length,
            instancesRemoved: 0,
            responsesRemoved: 0,
            messagesRemoved: 0,
            resolutions,
        };
    }

    // Answers and transcript rows are addressed by their own flowInstanceId, never by
    // conversationId: several runs share one conversation, so deleting by conversation
    // would take the surviving run's transcript with it.
    const responses = await flowResponseModel.deleteMany({ flowInstanceId: { $in: doomed } });
    const messages = await messageModel.deleteMany({ "guided.flowInstanceId": { $in: doomed } });
    const instances = await flowInstanceModel.deleteMany({ _id: { $in: doomed } });

    console.log(
        `\nRemoved ${instances.deletedCount} instance(s), ${responses.deletedCount} response(s), ` +
            `${messages.deletedCount} message(s).`,
    );

    return {
        applied: true,
        groups: groups.length,
        instancesRemoved: instances.deletedCount,
        responsesRemoved: responses.deletedCount,
        messagesRemoved: messages.deletedCount,
        resolutions,
    };
}
