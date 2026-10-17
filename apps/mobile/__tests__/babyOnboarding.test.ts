/**
 * Client-side rules for baby onboarding: how the flow is routed, how the chat input
 * adapts to the child-specific nodes, and how children are filtered and labelled on the
 * dashboard.
 *
 * The date-bounds and history-clearing cases are the ones worth locking down — both are
 * places where sharing the mother's behaviour produces something quietly wrong.
 */
import i18n from "../src/i18n";
import { FLOW_SLUGS, MEASUREMENT_NODE_BOUNDS } from "../src/constants/chat";
import {
  EChildOnboardingStatus,
  IChild,
} from "../src/types/user.types";
import { FlowType, NodeType } from "../src/types/chat.types";
import {
  getCompletionMessage,
  getCompletionRedirect,
  isGuidedFlowType,
  resolveFlowConfig,
  shouldClearHistoryOnComplete,
  shouldSaveHistory,
} from "../src/utils/flowTypeResolver";
import {
  determineInputMode,
  getDateBoundsForNode,
  getMaxDateOfBirth,
  validateMeasurement,
} from "../src/utils/messageHelpers";
import {
  getChildAgeLabel,
  getChildInitial,
  getVisibleChildren,
} from "../src/utils/childAge";

/** Minimal AI message shaped like what the flow engine sends. */
const aiMessage = (id: string, nodeType: NodeType) =>
  ({
    type: "ai" as const,
    id,
    flowInstanceId: "fi_1",
    text: "",
    options: [],
    nodeType,
    timestamp: 0,
    uuid: "u1",
  });

/** i18next's t(), reduced to the interpolation these labels actually use. */
const t = ((key: string, opts?: { count?: number }) =>
  `${opts?.count ?? ""}:${key}`) as any;

describe("baby onboarding flow routing", () => {
  it("maps BABY_ONBOARDING to baby-onboarding-v1", () => {
    expect(FLOW_SLUGS[FlowType.BABY_ONBOARDING]).toBe("baby-onboarding-v1");
  });

  it("resolves the baby flow from its route slug even for a fully onboarded user", () => {
    // The entry point is the dashboard, so the caller is always already onboarded —
    // which is exactly the case the slug has to survive.
    const config = resolveFlowConfig("baby-onboarding-v1", true);
    expect(config.flowType).toBe(FlowType.BABY_ONBOARDING);
    expect(config.flowSlug).toBe("baby-onboarding-v1");
  });

  it("counts as a guided flow, so answers go down the request-response path", () => {
    expect(isGuidedFlowType(FlowType.BABY_ONBOARDING)).toBe(true);
    expect(isGuidedFlowType(FlowType.CHATBOT)).toBe(false);
  });

  it("saves history while running and clears it on completion", () => {
    // Clearing matters: history is keyed (user, flow slug), and one user runs this flow
    // once per child. Without the clear, the second child opens on the first's transcript.
    expect(shouldSaveHistory(FlowType.BABY_ONBOARDING)).toBe(true);
    expect(shouldClearHistoryOnComplete(FlowType.BABY_ONBOARDING)).toBe(true);
  });

  it("redirects to the dashboard, never to the onboarding-only ReferralCode screen", () => {
    const redirect = getCompletionRedirect(FlowType.BABY_ONBOARDING, true);
    expect(redirect?.screen).toBe("DashboardTabNavigator");
  });

  it("has its own completion copy", () => {
    const { message } = getCompletionMessage(FlowType.BABY_ONBOARDING);
    expect(message).toBe("chat.babyOnboardingComplete");
  });
});

describe("child date-of-birth bounds", () => {
  it("lets a newborn's date of birth be picked", () => {
    // The mother's cap is 18 years ago. Applying it here made every real infant date of
    // birth unselectable, which is the bug these separate bounds exist to prevent.
    const bounds = getDateBoundsForNode(
      aiMessage("child_dob", NodeType.QUESTION_DATE),
    );

    const fifteenDaysAgo = new Date();
    fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 15);

    expect(bounds.maximumDate.getTime()).toBeGreaterThan(fifteenDaysAgo.getTime());
    expect(bounds.minimumDate!.getTime()).toBeLessThan(fifteenDaysAgo.getTime());
  });

  it("floors the child picker at five years ago", () => {
    const bounds = getDateBoundsForNode(
      aiMessage("child_dob", NodeType.QUESTION_DATE),
    );

    const sixYearsAgo = new Date();
    sixYearsAgo.setFullYear(sixYearsAgo.getFullYear() - 6);

    expect(bounds.minimumDate!.getTime()).toBeGreaterThan(sixYearsAgo.getTime());
  });

  it("still caps the MOTHER's date of birth at the minimum age", () => {
    const bounds = getDateBoundsForNode(aiMessage("dob", NodeType.QUESTION_DATE));

    // Compared with tolerance, not by exact millisecond: both sides build their own
    // `new Date()`, so an exact match is a race that fails whenever the two calls land
    // in different milliseconds.
    expect(
      Math.abs(bounds.maximumDate.getTime() - getMaxDateOfBirth().getTime()),
    ).toBeLessThan(1000);
    expect(bounds.minimumDate).toBeUndefined();
  });
});

describe("birth measurement input", () => {
  it("asks for a numeric keypad on the measurement nodes", () => {
    // They are free-text nodes; without the id check they would fall through to the
    // generic text handler and get an alphabetic keyboard.
    const mode = determineInputMode(
      aiMessage("child_birth_weight", NodeType.QUESTION_FREE_TEXT),
      false,
      false,
    );
    expect(mode).toBe("number");
  });

  it("leaves ordinary free-text questions alone", () => {
    const mode = determineInputMode(
      aiMessage("child_name", NodeType.QUESTION_FREE_TEXT),
      false,
      false,
    );
    expect(mode).toBe("text");
  });

  /** The app's own translator, so these assert the copy a mother actually reads. */
  const translate = i18n.t.bind(i18n) as any;

  it("accepts a plausible measurement", () => {
    const node = aiMessage("child_birth_weight", NodeType.QUESTION_FREE_TEXT);
    expect(validateMeasurement(node, "3250", translate)).toBeNull();
  });

  it("accepts a decimal, since lengths are given to one place", () => {
    const node = aiMessage("child_birth_length", NodeType.QUESTION_FREE_TEXT);
    expect(validateMeasurement(node, "50.5", translate)).toBeNull();
  });

  it("rejects an out-of-range value rather than letting the server drop it", () => {
    const node = aiMessage("child_birth_weight", NodeType.QUESTION_FREE_TEXT);
    expect(validateMeasurement(node, "99999", translate)).toMatch(/between/i);
  });

  it("rejects text", () => {
    const node = aiMessage("child_birth_head_circumference", NodeType.QUESTION_FREE_TEXT);
    expect(validateMeasurement(node, "big", translate)).toMatch(/number/i);
  });

  /**
   * These two used to be English string literals in the helper, which meant a Hindi mother
   * was asked the question in Hindi and corrected in English — the only hardcoded copy left
   * anywhere in the infant flow.
   */
  it("speaks the language the rest of the screen is in", async () => {
    const node = aiMessage("child_birth_weight", NodeType.QUESTION_FREE_TEXT);

    await i18n.changeLanguage("hi");
    try {
      const outOfRange = validateMeasurement(node, "99999", translate);
      const notANumber = validateMeasurement(node, "big", translate);

      expect(outOfRange).toContain("500");
      expect(outOfRange).not.toMatch(/please enter/i);
      expect(notANumber).not.toMatch(/please enter/i);
      // Devanagari, rather than merely "not English".
      expect(notANumber).toMatch(/[\u0900-\u097F]/);
    } finally {
      await i18n.changeLanguage("en");
    }
  });

  it("has no opinion about non-measurement nodes", () => {
    const node = aiMessage("child_name", NodeType.QUESTION_FREE_TEXT);
    expect(validateMeasurement(node, "Aarav", translate)).toBeNull();
  });

  it("keeps its bounds in step with the server's", () => {
    // child-onboarding.projection.ts discards anything outside these. If the two drift,
    // the client happily submits answers the server silently throws away.
    expect(MEASUREMENT_NODE_BOUNDS.child_birth_weight).toEqual({
      min: 500,
      max: 8000,
      unit: "g",
    });
  });
});

describe("child list and age labels", () => {
  const completed = (over: Partial<IChild> = {}): IChild => ({
    _id: "c1",
    name: "Aarav",
    onboarding_status: EChildOnboardingStatus.COMPLETED,
    ...over,
  });

  it("hides a draft child left behind by an abandoned add", () => {
    const children = getVisibleChildren([
      completed(),
      { _id: "c2", onboarding_status: EChildOnboardingStatus.DRAFT },
    ]);

    expect(children).toHaveLength(1);
    expect(children[0]!._id).toBe("c1");
  });

  it("keeps legacy children that predate onboarding_status", () => {
    const children = getVisibleChildren([{ _id: "c3", name: "Meera" }]);
    expect(children).toHaveLength(1);
  });

  it("hides a completed-but-nameless row rather than drawing an empty circle", () => {
    const children = getVisibleChildren([completed({ name: undefined })]);
    expect(children).toHaveLength(0);
  });

  it("handles no children at all", () => {
    expect(getVisibleChildren(undefined)).toEqual([]);
    expect(getVisibleChildren([])).toEqual([]);
  });

  it("labels a newborn in days", () => {
    const dob = new Date();
    dob.setDate(dob.getDate() - 15);
    expect(getChildAgeLabel(dob, t)).toBe("15:infant.ageDays");
  });

  it("switches to months once days stop being useful", () => {
    const dob = new Date();
    dob.setDate(dob.getDate() - 200);
    expect(getChildAgeLabel(dob, t)).toMatch(/infant\.ageMonths$/);
  });

  it("switches to years past two", () => {
    const dob = new Date();
    dob.setFullYear(dob.getFullYear() - 3);
    expect(getChildAgeLabel(dob, t)).toMatch(/infant\.ageYears$/);
  });

  it("never renders a negative age when the device clock runs behind", () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    expect(getChildAgeLabel(tomorrow, t)).toBe("0:infant.ageDays");
  });

  it("returns nothing for a missing or unparseable date of birth", () => {
    expect(getChildAgeLabel(undefined, t)).toBe("");
    expect(getChildAgeLabel("not-a-date", t)).toBe("");
  });

  it("falls back to a neutral initial for an unnamed child", () => {
    expect(getChildInitial({ name: "Aarav" })).toBe("A");
    expect(getChildInitial({})).toBe("?");
  });
});
