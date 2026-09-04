import { EContentGroup, IContent } from "../../types/content.types";
import { ESubscriptionTier } from "../../types/subscription.types";
import { EAccess, ECapability, getRule } from "../entitlements/entitlement.config";

/**
 * Applies the tier's content entitlement to a result set.
 *
 * Two groups behave differently:
 *  - GLOBAL_HEALTH is open to every tier, unlimited.
 *  - WEEKLY_RECOVERY is sliced: FREE sees one item (the one matching her week), TRIAL up
 *    to six, PREMIUM everything.
 *
 * Items beyond the slice are returned LOCKED rather than dropped. Seeing that an article
 * exists is what makes the paywall meaningful — and it lets the app render a lock badge
 * instead of a mysteriously short list.
 */

/** A locked item keeps enough to render a teaser and nothing more. */
export function redactContent(content: IContent): Partial<IContent> {
    return {
        _id: content._id,
        featuredTitle: content.featuredTitle,
        featuredImage: content.featuredImage,
        contentGroup: content.contentGroup,
        category: content.category,
        validWeekStart: content.validWeekStart,
        validWeekEnd: content.validWeekEnd,
        // contentBody is deliberately absent — shipping the article and asking the UI to
        // hide it is not a paywall.
        isLocked: true,
    };
}

function toPlain(content: IContent | any): IContent {
    return content && typeof content.toObject === "function" ? content.toObject() : content;
}

/**
 * Split a list into what this tier may read and what it may only see the shape of.
 * Order is preserved so the caller's sort still governs the response.
 */
export function applyContentEntitlements(
    contents: IContent[],
    tier: ESubscriptionTier,
): Array<IContent | Partial<IContent>> {
    // How many of a group this tier may read. The three states must be kept distinct —
    // conflating them is a paywall hole:
    //   LOCKED         -> 0 (a spent/absent limit is NOT the same as unlimited)
    //   limit === null -> unlimited
    //   limit === n    -> exactly n
    // Reading `.limit` alone treats LOCKED (undefined) as null/unlimited, which would
    // hand every unclassified article to a FREE user.
    const allowance = (capability: ECapability): number => {
        const rule = getRule(tier, capability);
        if (rule.access === EAccess.LOCKED) return 0;
        return rule.limit == null ? Infinity : rule.limit;
    };

    let recoveryAllowed = allowance(ECapability.CONTENT_WEEKLY_RECOVERY);
    let otherAllowed = allowance(ECapability.CONTENT_OTHER);

    return contents.map((raw) => {
        const content = toPlain(raw);

        // Always unlocked, every tier.
        if (content.contentGroup === EContentGroup.GLOBAL_HEALTH) {
            return content;
        }

        // An explicit content-ops override: a premium article deliberately opened up as a
        // free teaser. It does not consume either slice.
        if (content.isFreeOverride) {
            return content;
        }

        // Unclassified articles — the structural paywall. FREE gets 0, TRIAL a few,
        // PREMIUM all.
        if (!content.contentGroup) {
            if (otherAllowed > 0) {
                otherAllowed -= 1;
                return content;
            }
            return redactContent(content);
        }

        // Weekly recovery articles.
        if (recoveryAllowed > 0) {
            recoveryAllowed -= 1;
            return content;
        }

        return redactContent(content);
    });
}
