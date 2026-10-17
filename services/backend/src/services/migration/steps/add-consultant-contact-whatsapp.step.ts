import careManagerModel from "../../../models/care-manager.model";
import expertModel from "../../../models/expert.model";
import { expert as expertConstants } from "../../../constants/expert";

/**
 * Backfills `contactWhatsappNumber` on experts and care managers.
 *
 * Every consultant is pointed at the coordinator's number, not their own: she agrees the
 * exact call time with the doctor by hand and reports it back. The value lives on the
 * document rather than in code precisely so that switching a consultant to direct
 * notifications later is a DB edit and not a release.
 *
 * Idempotent — only documents that are missing the field or hold null are touched, so a
 * consultant already pointed at their own number is never clobbered by a re-run.
 */
export async function migrate(): Promise<{
    expertsUpdated: number;
    careManagersUpdated: number;
}> {
    console.log("Starting migration to add contactWhatsappNumber to consultants...");

    const filter = {
        $or: [{ contactWhatsappNumber: { $exists: false } }, { contactWhatsappNumber: null }],
    };
    const update = { $set: { contactWhatsappNumber: expertConstants.whatsappMessageReceiver } };

    const expertResult = await expertModel.updateMany(filter, update);
    const careManagerResult = await careManagerModel.updateMany(filter, update);

    console.log(
        `contactWhatsappNumber backfilled -> experts: ${expertResult.modifiedCount}, care managers: ${careManagerResult.modifiedCount}`,
    );

    return {
        expertsUpdated: expertResult.modifiedCount,
        careManagersUpdated: careManagerResult.modifiedCount,
    };
}
