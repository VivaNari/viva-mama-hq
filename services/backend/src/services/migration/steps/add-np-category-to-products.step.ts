import productModel from "../../../models/product.model";
import { EUserCategory } from "../../../types/user.types";

/**
 * Adds NP (pregnant, not yet postpartum) to the audience of every product.
 *
 * Mirrors add-np-category-to-contents. The recommendation list was curated PP-first, so
 * a pregnant user's product feed comes back empty — audience membership is the first
 * clause of the read in ProductController.getProducts.
 *
 * Note the field is `userCategory` here, not `category` as on contents. Same concept,
 * different name, and getting it wrong would silently match nothing.
 *
 * Uses $addToSet, so a product already tagged NP is left alone and a re-run is a no-op.
 * As with contents this widens every product indiscriminately — see the caveat there.
 */
export async function migrate(): Promise<{ matched: number; updated: number }> {
    console.log("Starting migration to add the NP category to products...");

    const result = await productModel.updateMany(
        { userCategory: { $ne: EUserCategory.NP } },
        { $addToSet: { userCategory: EUserCategory.NP } },
    );

    console.log(
        `NP category added -> matched: ${result.matchedCount}, updated: ${result.modifiedCount}`,
    );

    return { matched: result.matchedCount, updated: result.modifiedCount };
}
