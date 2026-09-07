/**
 * ChatWithVivaAI derives guided flow from `resolveFlowConfig(route.params?.flowSlug, isFullyOnboarded())`
 * (see `src/screens/ChatWithVivaAI.tsx`). These tests lock the onboarding slug and related behavior.
 */
import { FLOW_SLUGS } from "../src/constants/chat";
import { FlowType } from "../src/types/chat.types";
import {
  getCompletionMessage,
  getCompletionRedirect,
  resolveFlowConfig,
  shouldClearHistoryOnComplete,
  shouldSaveHistory,
} from "../src/utils/flowTypeResolver";

describe("onboarding flow config (FLOW_SLUGS + flowTypeResolver)", () => {
  it("maps FlowType.ONBOARDING to onboarding-flow-v2", () => {
    expect(FLOW_SLUGS[FlowType.ONBOARDING]).toBe("onboarding-flow-v2");
  });

  it("resolves onboarding for ChatWithVivaAI when there is no route slug and user is not fully onboarded", () => {
    const config = resolveFlowConfig(undefined, false);
    expect(config).toEqual({
      flowType: FlowType.ONBOARDING,
      flowSlug: "onboarding-flow-v2",
    });
  });

  it("does not resolve to onboarding when a route slug is present (check-in)", () => {
    const config = resolveFlowConfig("weekly-checkin-v1", false);
    expect(config.flowType).toBe(FlowType.CHECKIN);
    expect(config.flowSlug).toBe(FLOW_SLUGS[FlowType.CHECKIN]);
  });

  it("saves chat history for onboarding", () => {
    expect(shouldSaveHistory(FlowType.ONBOARDING)).toBe(true);
  });

  it("does not clear history on complete for onboarding (only check-in clears)", () => {
    expect(shouldClearHistoryOnComplete(FlowType.ONBOARDING)).toBe(false);
  });

  // Was "Services". The referral step moved ahead of the plan catalog, because a code
  // can attach a subscription and asking for it afterwards would have her pay for what
  // it would have given her free. ReferralCode forwards to Services itself when no code
  // is entered or the code grants nothing.
  it("redirects onboarding completion to ReferralCode", () => {
    expect(getCompletionRedirect(FlowType.ONBOARDING)).toEqual({
      screen: "ReferralCode",
      delay: 5000,
    });
  });

  /**
   * resolveFlowConfig honours a route slug, so an already-onboarded user handed the
   * onboarding slug (an FCM deep link can supply one) runs that flow inside AppStack —
   * where ReferralCode is not a registered route. Resetting to it there would throw.
   */
  it("sends an already-onboarded user home instead, where ReferralCode does not exist", () => {
    expect(getCompletionRedirect(FlowType.ONBOARDING, true)).toEqual({
      screen: "DashboardTabNavigator",
      delay: 3000,
    });
  });

  it("uses onboarding completion copy from getCompletionMessage", () => {
    const { title, message } = getCompletionMessage(FlowType.ONBOARDING);
    expect(title).toBe("chat.completeTitle");
    expect(message).toBe("chat.onboardingComplete");
  });
});
