import expertModel from "../../models/expert.model";
import UserModel from "../../models/user.model";
import { IExpert } from "../../types/expert.types";
import BaseService from "../base.service";
import { isInPersonOnlyExpert } from "./expert.rules";

export class ExpertService extends BaseService<IExpert> {
    constructor() {
        super(expertModel);
    }

    /**
     * The active experts a given user is allowed to see.
     *
     * Two rules apply, in this order:
     *
     *  1. In-person-only experts (see isInPersonOnlyExpert) are shown to their own
     *     referred patients and to nobody else. They charge nothing through the app
     *     because they see their patients at their own clinic, so listing them to the
     *     general directory would offer a booking that cannot be completed.
     *  2. A user who signed up through an expert's referral code has that expert on
     *     `referred_by_expert_id`. Within that expert's category she only ever sees her
     *     own referrer — we never show her a competing expert in the same speciality.
     *     Every other category stays fully visible.
     *
     * This is the single source of truth for both: the experts list endpoint, the
     * single-expert endpoint and the chatbot's expert suggestions all go through it.
     * The chatbot's Python pipeline mirrors it when building its prompt directory
     * (rag_chatbot/app/mcp/tools/get_experts_tool.py) — keep the two in step.
     */
    public getVisibleExperts = async (userId: string): Promise<IExpert[]> => {
        const experts: IExpert[] = await this.find({
            filter: {
                isActive: true,
            },
            populate: "category",
            // Never leaves the server. localizeExpert strips it too — this is the
            // belt to that braces, because a referral code now grants a subscription
            // and any new caller that forgets to localize must still not leak one.
            selectedKeys: ["-referralCode"],
        });

        const user = await UserModel.findById(userId);
        const referredById = user?.referred_by_expert_id
            ? String(user.referred_by_expert_id)
            : null;

        // Rule 1. Applied before the category rule, and to everyone including users with
        // no referral at all, so an in-person-only doctor is never a stranger's search
        // result.
        const visible = experts.filter(
            (e) => !isInPersonOnlyExpert(e) || String(e._id) === referredById,
        );

        if (!referredById) {
            return visible;
        }

        const referredExpert = visible.find((e) => String(e._id) === referredById);

        // No referring expert in the active list — she was deactivated or removed.
        // Fall back to showing everyone rather than hiding a whole category.
        if (!referredExpert) {
            return visible;
        }

        const referredCategoryId = this.getCategoryId(referredExpert);

        return visible.filter((e) => {
            if (String(e._id) === referredById) return true;
            return this.getCategoryId(e) !== referredCategoryId;
        });
    };

    /**
     * One expert, but only if this user is allowed to see her.
     *
     * Goes through getVisibleExperts rather than a direct findById so the detail screen
     * cannot be used to walk around the list rule: an expert id is guessable, and an
     * in-person-only doctor's profile would otherwise be readable — and her booking
     * button tappable — by any patient who is not hers.
     */
    public getVisibleExpertById = async (
        userId: string,
        expertId: string,
    ): Promise<IExpert | null> => {
        const experts = await this.getVisibleExperts(userId);
        return experts.find((e) => String(e._id) === String(expertId)) ?? null;
    };

    /**
     * Category id as a string, whether or not `category` has been populated.
     * Comparing populated categories directly would stringify the whole sub-document.
     */
    private getCategoryId = (expert: IExpert): string => {
        const category = expert.category as unknown as { _id?: unknown } | null;
        if (category && typeof category === "object" && "_id" in category) {
            return String(category._id);
        }
        return String(category);
    };
}
