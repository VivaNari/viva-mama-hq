// src/utils/flowTypeResolver.ts
import { FlowType } from "../types/chat.types";
import { FLOW_SLUGS } from "../constants/chat";

interface FlowConfig {
  flowType: FlowType;
  flowSlug: string;
}

/**
 * Resolves the flow type and slug based on route params and onboarding status
 */
export const resolveFlowConfig = (
  routeFlowSlug: string | undefined,
  isFullyOnboarded: boolean,
): FlowConfig => {
  // Honour the slug that was actually passed. This used to treat any truthy value as a
  // boolean "it's a check-in" flag and substitute the check-in slug, which meant the
  // slug an FCM deep link supplied was silently discarded — any other flow routed
  // through this screen would have run the weekly check-in instead.
  if (routeFlowSlug) {
    const matched = (Object.entries(FLOW_SLUGS) as [FlowType, string][]).find(
      ([, slug]) => slug === routeFlowSlug,
    );

    if (matched) {
      return { flowType: matched[0], flowSlug: matched[1] };
    }

    // An unrecognised slug is a server/client mismatch, not a reason to run the wrong
    // flow. Fall through to the onboarding/chatbot decision below.
  }

  // If not fully onboarded, it's the onboarding flow
  if (!isFullyOnboarded) {
    return {
      flowType: FlowType.ONBOARDING,
      flowSlug: FLOW_SLUGS[FlowType.ONBOARDING],
    };
  }

  // Otherwise, it's the chatbot flow
  return {
    flowType: FlowType.CHATBOT,
    flowSlug: FLOW_SLUGS[FlowType.CHATBOT],
  };
};

/**
 * Guided flows use the request-response engine; CHATBOT uses SSE.
 *
 * Extracted because this test was written out longhand in both ChatWithVivaAI and
 * useChatActions, and the two have to agree: if one counts a flow as guided and the other
 * does not, answers are submitted down one path and rendered by the other.
 */
export const isGuidedFlowType = (flowType: FlowType | null): boolean => {
  return (
    flowType === FlowType.ONBOARDING ||
    flowType === FlowType.CHECKIN ||
    flowType === FlowType.BABY_ONBOARDING
  );
};

/**
 * Check if the flow type requires saving chat history
 */
export const shouldSaveHistory = (flowType: FlowType): boolean => {
  // Guided flows save history so a killed app resumes where it left off.
  // CHATBOT has no history interaction.
  return (
    flowType === FlowType.CHECKIN ||
    flowType === FlowType.ONBOARDING ||
    flowType === FlowType.BABY_ONBOARDING
  );
};

/**
 * Check if the flow should clear history after completion
 *
 * BABY_ONBOARDING clears for the same reason CHECKIN does, and it matters more here:
 * SQLite history is keyed (user_id, flow_slug), and one user runs this flow once per
 * child. Without the clear, "Add your baby" for a second child would open on top of the
 * first child's transcript, with that child's answered bubbles still on screen.
 */
export const shouldClearHistoryOnComplete = (flowType: FlowType): boolean => {
  return flowType === FlowType.CHECKIN || flowType === FlowType.BABY_ONBOARDING;
};

/**
 * Check if the flow should redirect after completion
 *
 * `isFullyOnboarded` decides which stack we are in, and therefore which routes exist.
 * It matters because resolveFlowConfig above honours a route slug: an already-onboarded
 * user handed the onboarding slug (an FCM deep link can supply one) runs that flow
 * inside AppStack, where the onboarding-only screens are not registered. Resetting to
 * one of them there would throw.
 */
export const getCompletionRedirect = (
  flowType: FlowType,
  isFullyOnboarded = false,
): { screen: string; delay: number } | null => {
  switch (flowType) {
    case FlowType.ONBOARDING:
      // Already onboarded: she has a plan and a referral status already, so send her
      // home. "ReferralCode" is an OnboardingStack route and does not exist here.
      if (isFullyOnboarded) {
        return { screen: "DashboardTabNavigator", delay: 3000 };
      }
      // The referral step comes before the plan catalog: a code can attach a
      // subscription, and asking for it afterwards would have her pay for what it
      // would have given her free. ReferralCode forwards to "Services" itself when
      // no code is entered or the code grants nothing.
      return { screen: "ReferralCode", delay: 5000 };
    case FlowType.CHECKIN:
      return { screen: "DashboardTabNavigator", delay: 3000 };
    // Straight to the dashboard, where the Infant tab now has a child to show. Never to
    // ReferralCode: this flow does not change her subscription or her own onboarding.
    case FlowType.BABY_ONBOARDING:
      return { screen: "DashboardTabNavigator", delay: 3000 };
    case FlowType.CHATBOT:
      return null;
    default:
      return null;
  }
};

/**
 * Get completion message based on flow type
 */
// Returns i18n keys (resolved with t() at the display site), not display text.
export const getCompletionMessage = (
  flowType: FlowType,
): { title: string; message: string } => {
  switch (flowType) {
    case FlowType.ONBOARDING:
      return {
        title: "chat.completeTitle",
        message: "chat.onboardingComplete",
      };
    case FlowType.CHECKIN:
      return {
        title: "chat.completeTitle",
        message: "chat.checkinComplete",
      };
    case FlowType.BABY_ONBOARDING:
      return {
        title: "chat.babyOnboardingCompleteTitle",
        message: "chat.babyOnboardingComplete",
      };
    default:
      return {
        title: "chat.completeTitle",
        message: "chat.flowComplete",
      };
  }
};
