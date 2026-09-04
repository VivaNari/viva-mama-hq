import { useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import Toast from "react-native-toast-message";

import apiClientInterceptor from "../api/apiClientInterceptor";
import { GUIDED_FLOW_START, GUIDED_FLOW_ANSWER } from "../constants/endpoints";
import { FlowType, IAiMessage, ChatAction } from "../types/chat.types";
import { STILL_BIRTH_NODE_ID, STILL_BIRTH_TERMINATION } from "../constants/chat";
import { chatLogger } from "../utils/logger";
import { useAuth } from "../context/AuthContext";
import { chatDB } from "../db/sqlite";
import { AnalyticsEvent, track } from "../analytics";

interface UseGuidedFlowProps {
  flowType: FlowType | null;
  flowSlug: string | null;
  dispatch: React.Dispatch<ChatAction>;
  onMessageReceived: (message: IAiMessage) => Promise<void>;
  onFlowComplete: (flowType: FlowType) => Promise<void>;
  /**
   * Called once the server has told us which flow instance we are on, BEFORE the first
   * question is rendered. Lets the screen discard history belonging to a previous
   * instance — an abandoned check-in from an earlier week.
   */
  onFlowInstanceResolved?: (flowInstanceId: string) => Promise<void>;
}

/**
 * Hook for guided flows (Onboarding, Checkin) using request-response API
 * Replaces SSE for these flow types
 */
export const useGuidedFlow = ({
  flowType,
  flowSlug,
  dispatch,
  onMessageReceived,
  onFlowComplete,
  onFlowInstanceResolved,
}: UseGuidedFlowProps) => {
  const flowInstanceIdRef = useRef<string | null>(null);
  const { userId } = useAuth();
  const { t } = useTranslation();
  const weekRef = useRef(1);
  /**
   * How many questions the user has answered in this instance.
   *
   * Counted client-side because the flow branches server-side and never reports
   * a position or a total — this is the only way to see *where* people abandon
   * onboarding rather than just that they did.
   */
  const answeredCountRef = useRef(0);
  /**
   * Convert API question to IAiMessage format
   */
  const toAiMessage = useCallback((question: any): IAiMessage => {
    return {
      type: "ai",
      id: question.id,
      flowInstanceId: question.flowInstanceId,
      text: question.text,
      educationalMessage: question.educationalMessage,
      whyThisMatters: question.whyThisMatters,
      options: question.options.map((opt: any) => ({
        id: opt.id,
        label: opt.label,
        value: opt.value,
        score: opt.score,
      })),
      nodeType: question.nodeType,
      timestamp: Date.now(),
      uuid: `${question.id}-${Date.now()}`,
    };
  }, []);

  /**
   * Submit answer and get next question
   */
  const submitAnswer = useCallback(
    async (payload: {
      nodeId: string;
      selectedKeys?: number[];
      selectedValues?: string[];
      freeText?: string;
    }): Promise<boolean> => {
      if (!flowInstanceIdRef.current) {
        chatLogger.error("No flow instance ID");
        return false;
      }

      if (!userId) {
        chatLogger.warn("Cannot start flow: missing userId");
        return false;
      }

      // The week the flow was STARTED with. Re-reading it from the user record would
      // let a week rollover mid-conversation post answers against a week the instance
      // does not belong to, which the server rejects as a flow-instance mismatch.
      const week = weekRef.current;

      dispatch({ type: "SET_LOADING", payload: true });

      try {
        const { data } = await apiClientInterceptor().post(GUIDED_FLOW_ANSWER, {
          flowInstanceId: flowInstanceIdRef.current,
          nodeId: payload.nodeId,
          week: week,
          selectedValues: payload.selectedValues,
          selectedKeys: payload.selectedKeys,
          freeText: payload.freeText,
          idempotencyKey: `${flowInstanceIdRef.current}-${
            payload.nodeId
          }-${Date.now()}`,
        });

        if (!data.success) {
          throw new Error(data.message || "Failed to submit answer");
        }

        // The answer landed. Only the position is logged — never the option, the
        // free text or the date, all of which are health data.
        answeredCountRef.current += 1;
        if (flowType === FlowType.ONBOARDING) {
          track(AnalyticsEvent.ONBOARDING_STEP_COMPLETED, {
            step_index: answeredCountRef.current,
          });
        }

        // Grief-sensitive early exit: render the acknowledgement with dedicated
        // support buttons and lock further input, without the normal completion
        // redirect (the user is auto-enrolled in the free plan by the backend).
        if (data.data.terminationReason === STILL_BIRTH_TERMINATION) {
          const ackMessage: IAiMessage = {
            type: "ai",
            id: STILL_BIRTH_NODE_ID,
            flowInstanceId: flowInstanceIdRef.current,
            text: data.message,
            options: [],
            timestamp: Date.now(),
            uuid: `${STILL_BIRTH_NODE_ID}-${Date.now()}`,
          };
          await onMessageReceived(ackMessage);
          dispatch({ type: "SET_FLOW_COMPLETE", payload: true });
          return true;
        }

        if (data.data.isCompleted) {
          // Show completion message
          if (data.message) {
            const endMessage: IAiMessage = {
              type: "ai",
              id: `end-${Date.now()}`,
              flowInstanceId: flowInstanceIdRef.current,
              text: data.message,
              options: [],
              timestamp: Date.now(),
              uuid: `end-${Date.now()}`,
            };
            await onMessageReceived(endMessage);
          }

          dispatch({ type: "SET_FLOW_COMPLETE", payload: true });
          if (flowType === FlowType.CHECKIN) {
            track(AnalyticsEvent.CHECKIN_COMPLETED, {
              flow_slug: flowSlug ?? undefined,
            });
          }
          // Onboarding's completion is logged as `tutorial_complete` by
          // AuthContext.completeQuestionnaire, which onFlowComplete triggers.
          if (flowType) {
            await onFlowComplete(flowType);
          }
          return true;
        }

        if (data.data.nextQuestion) {
          console.log("next question is => ", data.data.nextQuestion);
          const aiMessage = toAiMessage(data.data.nextQuestion);
          await onMessageReceived(aiMessage);
        }

        return true;
      } catch (error: any) {
        chatLogger.error("Failed to submit answer", error);

        // 402 already opened the global PaywallSheet via the axios interceptor.
        if (error.response?.status !== 402) {
          Toast.show({
            type: "error",
            text1: t("common.error"),
            text2: error.response?.data?.message || t("chat.submitFailed"),
            position: "bottom",
          });
        }
        dispatch({ type: "SET_LOADING", payload: false });
        return false;
      }
    },
    [
      userId,
      dispatch,
      flowType,
      flowSlug,
      onMessageReceived,
      onFlowComplete,
      toAiMessage,
      t,
    ],
  );

  /**
   * Start/Resume the guided flow
   * Backend handles both new flows and resuming existing ones
   */
  const initialize = useCallback(async () => {
    // Each of these used to `return` silently, leaving a blank chat screen with no
    // spinner, no message and no way back. Surface them as a retryable error instead.
    if (!flowSlug || !userId) {
      chatLogger.warn("Cannot start flow: missing flowSlug or userId");
      dispatch({ type: "SET_ERROR", payload: t("chat.startFailed") });
      return;
    }

    const dbUser = await chatDB.getUserData(userId);
    if (!dbUser) {
      chatLogger.warn("Cannot start flow: missing dbUser");
      dispatch({ type: "SET_ERROR", payload: t("chat.startFailed") });
      return;
    }
    // Prefer active_checkin.week for check-ins: the server computes it live from the
    // delivery date, whereas current_weekdays.weeks is only rewritten by the nightly
    // job. If that job is late or failed, the stored copy lags the real week and the
    // start endpoint rejects it as "not triggered yet". Onboarding has no active_checkin
    // and legitimately falls back to the stored week.
    const week =
      (flowType === FlowType.CHECKIN
        ? dbUser?.data.user.active_checkin?.week
        : undefined) ?? dbUser?.data.user.current_weekdays.weeks;

    dispatch({ type: "SET_LOADING", payload: true });

    try {
      const { data } = await apiClientInterceptor().post(GUIDED_FLOW_START, {
        flowSlug,
        week: week,
      });

      if (!data.success) {
        throw new Error(data.message || "Failed to start flow");
      }

      flowInstanceIdRef.current = data.data.flowInstanceId;
      weekRef.current = data.data.week;

      // Resuming counts as a fresh entry into the flow for funnel purposes, but
      // the step counter must restart or a resumed instance would report step
      // numbers continuing from the previous mount.
      answeredCountRef.current = 0;
      if (flowType === FlowType.ONBOARDING) {
        track(AnalyticsEvent.TUTORIAL_BEGIN);
      } else if (flowType === FlowType.CHECKIN) {
        track(AnalyticsEvent.CHECKIN_STARTED, {
          flow_slug: flowSlug ?? undefined,
        });
      }

      // Before anything is rendered: if the stored conversation belongs to an older
      // instance, drop it. Otherwise last week's abandoned questions sit above this
      // week's, still tappable, and answering one posts a stale nodeId.
      if (onFlowInstanceResolved && data.data.flowInstanceId) {
        await onFlowInstanceResolved(data.data.flowInstanceId);
      }

      if (data.data.isCompleted) {
        dispatch({ type: "SET_FLOW_COMPLETE", payload: true });
        if (flowType) {
          await onFlowComplete(flowType);
        }
        return;
      }

      if (data.data.nextQuestion) {
        const aiMessage = toAiMessage(data.data.nextQuestion);
        await onMessageReceived(aiMessage);
      }
    } catch (error: any) {
      chatLogger.error("Failed to start guided flow", error);

      const status = error.response?.status;

      // 402 is a paywall refusal. The axios interceptor has already opened the global
      // PaywallSheet, so a toast here would stack a generic error on top of it.
      if (status === 402) {
        dispatch({ type: "SET_ERROR", payload: t("chat.checkinLocked") });
        return;
      }

      // 409 means she already finished this week's check-in — a terminal success, not a
      // fault. Render it as the completion message rather than a red toast.
      if (status === 409) {
        dispatch({ type: "SET_FLOW_COMPLETE", payload: true });
        await onMessageReceived({
          type: "ai",
          id: `already-complete-${Date.now()}`,
          flowInstanceId: flowInstanceIdRef.current ?? "",
          text: error.response?.data?.message ?? "",
          options: [],
          timestamp: Date.now(),
          uuid: `already-complete-${Date.now()}`,
        });
        return;
      }

      dispatch({
        type: "SET_ERROR",
        payload: error.response?.data?.message || t("chat.startFailed"),
      });
    }
  }, [
    flowSlug,
    userId,
    dispatch,
    flowType,
    onFlowComplete,
    toAiMessage,
    onMessageReceived,
    onFlowInstanceResolved,
    t,
  ]);

  return {
    initialize,
    submitAnswer,
    flowInstanceId: flowInstanceIdRef.current,
  };
};
