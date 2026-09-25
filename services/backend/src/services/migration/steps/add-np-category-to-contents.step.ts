import contentModel from "../../../models/content.model";
import { EUserCategory } from "../../../types/user.types";

/**
 * Adds NP (pregnant, not yet postpartum) to the audience of every article.
 *
 * Content was authored PP-first, so most articles are tagged for postpartum Mamas only
 * and a pregnant user sees nothing — `category` membership is the first clause of the
 * read in ContentController.getContents, so an article without NP is invisible to her.
 *
 * Uses $addToSet, so an article already tagged NP is left alone and a re-run is a no-op.
 * Note this widens the audience of every article indiscriminately: it is the right call
 * while the library is small and broadly applicable, but once NP-specific content exists
 * the tagging should be curated per article rather than swept.
 */
export async function migrate(): Promise<{ matched: number; updated: number }> {
    console.log("Starting migration to add the NP category to contents...");

    const result = await contentModel.updateMany(
        { category: { $ne: EUserCategory.NP } },
        { $addToSet: { category: EUserCategory.NP } },
    );

    console.log(
        `NP category added -> matched: ${result.matchedCount}, updated: ${result.modifiedCount}`,
    );

    return { matched: result.matchedCount, updated: result.modifiedCount };
}
