import conversationModel from "../../models/conversation.model";
import { ONBOARDING_SLUG } from "../../constants/conversationSlugs";
import { WEEKLY_CHECKIN_SLUG } from "../../constants/chat";
import { IUser } from "../../types";

/**
 * One definition of "which conversation does this flow belong to".
 *
 * This existed in four places, each hardcoding its own tag. The check-in's version was
 * also used for ONBOARDING — validateSSERequest is shared between the two flows, and its
 * conversation lookup asked for tag "check-in" whatever the flow was. So a new user's
 * onboarding created a conversation tagged "check-in" and titled "Weekly Check-in", and
 * her first weekly check-in then found that same row and reused it. Onboarding answers
 * and check-in answers ended up interleaved in a single server-side thread.
 *
 * Keyed on the flow SLUG rather than a flow-type enum because the slug is what every
 * call site actually has, and it is what distinguishes the two flows on the request.
 */

interface ConversationIdentity {
    tag: string;
    title: string;
}

const identityFor = (flowSlug: string): ConversationIdentity => {
    if (flowSlug === ONBOARDING_SLUG) {
        return { tag: "onboarding", title: "Onboarding" };
    }

    if (flowSlug === WEEKLY_CHECKIN_SLUG) {
        return { tag: "check-in", title: "Weekly Check-in" };
    }

    // Any future guided flow gets its own thread rather than silently joining one of
    // the above — which is exactly the failure this module exists to prevent.
    return { tag: flowSlug, title: flowSlug };
};

/**
 * The conversation this flow's messages belong in, creating it on first use.
 *
 * Deliberately one conversation per (user, flow) rather than per instance: the weekly
 * check-in is meant to read as a single continuing thread across all 52 weeks.
 */
export const getOrCreateFlowConversation = async (
    user: Pick<IUser, "_id">,
    flowSlug: string,
): Promise<{ _id: unknown }> => {
    const { tag, title } = identityFor(flowSlug);

    const existing = await conversationModel.findOne({
        userId: user._id,
        chatMode: "GUIDED_ONLY",
        "meta.tags": tag,
    });

    if (existing) return existing;

    return conversationModel.create({
        userId: user._id,
        title,
        chatMode: "GUIDED_ONLY",
        lastMessageAt: new Date(),
        meta: { channel: "App", tags: [tag] },
    });
};
