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

  it("redirects onboarding completion to Services", () => {
    expect(getCompletionRedirect(FlowType.ONBOARDING)).toEqual({
      screen: "Services",
      delay: 5000,
    });
  });

  it("uses onboarding completion copy from getCompletionMessage", () => {
    const { title, message } = getCompletionMessage(FlowType.ONBOARDING);
    expect(title).toBe("Complete");
    expect(message).toContain("onboarding");
  });
});
