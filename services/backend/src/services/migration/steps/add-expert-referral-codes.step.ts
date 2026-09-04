import expertModel from "../../../models/expert.model";

export async function migrate(): Promise<{ updated: number; missing: number }> {
    console.log("Starting migration to add referral codes to experts...");

    // Fetch all experts that might be missing a referralCode or have it set to null
    const experts = await expertModel.find({
        $or: [{ referralCode: { $exists: false } }, { referralCode: null }],
    });

    if (experts.length === 0) {
        console.log("No experts found that need updating.");
        return { updated: 0, missing: 0 };
    }

    const initialsCount: Record<string, number> = {};
    let updatedCount = 0;

    for (const expert of experts) {
        // 1. Generate Referral Code
        const nameParts = expert.name
            .trim()
            .split(/\s+/)
            .filter((part: string) => {
                const lower = part.toLowerCase();
                return lower !== "dr" && lower !== "dr.";
            });
        let initials = "";

        if (nameParts.length >= 2) {
            // First char of first name, First char of second name
            initials = `${nameParts[0]!.charAt(0)}${nameParts[1]!.charAt(0)}`.toUpperCase();
        } else if (nameParts.length === 1) {
            // If only one name, take first two characters or just the first
            initials = nameParts[0]!.substring(0, 2).toUpperCase();
        } else {
            // Fallback for weird edge cases
            initials = "EX";
        }

        if (!initialsCount[initials]) {
            initialsCount[initials] = 1;
        } else {
            initialsCount[initials] = (initialsCount[initials] || 0) + 1;
        }

        const counter = initialsCount[initials];
        const referralCode = `${initials}${counter}2026`;

        // 2. Update the expert. Category is no longer backfilled here — it is an
        // ObjectId ref to `expert_categories` managed by the seed-expert-categories
        // and migrate-expert-category-to-ref migrations.
        await expertModel.updateOne(
            { _id: expert._id },
            {
                $set: {
                    referralCode,
                },
            },
        );
        updatedCount++;
        console.log(`Updated expert: ${expert.name} -> Code: ${referralCode}`);
    }

    console.log(`Migration completed. Updated ${updatedCount} experts.`);
    return { updated: updatedCount, missing: 0 };
}
