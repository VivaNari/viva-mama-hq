import { useCallback } from "react";
import Toast from "react-native-toast-message";

import apiClientInterceptor from "../api/apiClientInterceptor";
import { CHAT_FLOW_ANSWER } from "../constants/endpoints";
import {
  FlowType,
  IOption,
  IAiMessage,
  ChatAction,
  ChatState,
} from "../types/chat.types";
import { LMP_DATE_PREFIX, NOT_PREGNANT_VALUE } from "../constants/chat";
import {
  formatDateForApi,
  getSelectedLabels,
  getSelectedScores,
  getSelectedValues,
  isTextInputMessage,
  isDateInputMessage,
} from "../utils/messageHelpers";
import { chatLogger } from "../utils/logger";
import { t } from "i18next";
import { AnalyticsEvent, lengthBucket, track } from "../analytics";

interface UseChatActionsProps {
  state: ChatState;
  userId: string | null;
  flowType: FlowType | null;
  dispatch: React.Dispatch<ChatAction>;
  getLastAiMessage: () => Promise<IAiMessage | null>;
  saveUserMessage: (text: string, lastAiMessageId?: string) => Promise<void>;
  // New: Optional guided flow submit function
  submitGuidedAnswer?: (payload: {
    nodeId: string;
    selectedKeys?: number[];
    selectedValues?: string[];
    freeText?: string;
  }) => Promise<boolean>;
  selectedModel?: string; // New: Selected model for chatbot flow
}

export const useChatActions = ({
  state,
  userId,
  flowType,
  dispatch,
  getLastAiMessage,
  saveUserMessage,
  submitGuidedAnswer,
  selectedModel,
}: UseChatActionsProps) => {
  /**
   * Check if this is a guided flow (uses request-response)
   */
  const isGuidedFlow =
    flowType === FlowType.ONBOARDING || flowType === FlowType.CHECKIN;

  /**
   * Send answer for CHATBOT flow (SSE-based)
   */
  const sendChatbotAnswer = useCallback(
    async (payload: {
      freeText?: string;
      sessionId?: string;
      conversationId?: string;
    }): Promise<boolean> => {
      try {
        console.log("[API] Selected model: ", selectedModel);
        await apiClientInterceptor().post(CHAT_FLOW_ANSWER, {
          userId,
          flowInstanceId: "chatbot",
          nodeId: "chatbot",
          freeText: payload.freeText,
          flowType,
          sessionId: payload.sessionId,
          conversationId: payload.conversationId,
          model: selectedModel || "qwen/qwen3-32b",
        });
        // Only how long the message was, bucketed — never its text. What a user
        // types to a maternal-health assistant is exactly what must not leave
        // the device.
        track(AnalyticsEvent.CHAT_MESSAGE_SENT, {
          flow_type: flowType ?? undefined,
          length_bucket: lengthBucket(payload.freeText?.length ?? 0),
        });
        return true;
      } catch (error: any) {
        chatLogger.error("Failed to send chatbot answer", error);
        Toast.show({
          type: "error",
          text1: "Error",
          text2: error.response?.data?.message || "Failed to send message",
          position: "bottom",
        });
        track(AnalyticsEvent.CHAT_STREAM_FAILED, {
          reason: String(error.response?.status ?? "network"),
          flow_type: flowType ?? undefined,
        });
        dispatch({ type: "SET_LOADING", payload: false });
        return false;
      }
    },
    [userId, flowType, dispatch, selectedModel],
  );

  /**
   * Handle single option selection
   */
  const handleOptionSelect = useCallback(
    async (option: IOption) => {
      const lastAi = await getLastAiMessage();
      if (!lastAi) {
        chatLogger.error("No AI message to respond to");
        return;
      }

      await saveUserMessage(option.label, lastAi.id);

      if (isGuidedFlow && submitGuidedAnswer) {
        await submitGuidedAnswer({
          nodeId: lastAi.id,
          // `value` identifies the option; `score` is only its weight and is
          // ambiguous across options, so it is sent purely for older servers.
          selectedValues: [option.value],
          selectedKeys: [option.score],
        });
      }
    },
    [getLastAiMessage, saveUserMessage, isGuidedFlow, submitGuidedAnswer],
  );

  /**
   * Handle multi-select submission
   */
  const handleMultiSelectSubmit = useCallback(
    async (selectedOptions: Set<string>, options: IOption[]) => {
      if (selectedOptions.size === 0) {
        Toast.show({
          type: "info",
          text1: "Please select at least one option",
          position: "bottom",
        });
        return;
      }

      const lastAi = await getLastAiMessage();
      if (!lastAi) {
        chatLogger.error("No AI message to respond to");
        return;
      }

      const selectedLabels = getSelectedLabels(selectedOptions, options);
      const selectedScores = getSelectedScores(selectedOptions, options);
      const selectedValues = getSelectedValues(selectedOptions, options);

      await saveUserMessage(selectedLabels, lastAi.id);
      dispatch({ type: "CLEAR_MULTI_OPTIONS" });

      if (isGuidedFlow && submitGuidedAnswer) {
        await submitGuidedAnswer({
          nodeId: lastAi.id,
          // `value` identifies the options; `score` is only their weight and is
          // ambiguous across options, so it is sent purely for older servers.
          selectedValues,
          selectedKeys: selectedScores,
        });
      }
    },
    [
      getLastAiMessage,
      saveUserMessage,
      dispatch,
      isGuidedFlow,
      submitGuidedAnswer,
    ],
  );

  /**
   * Handle text submission
   */
  const handleTextSubmit = useCallback(
    async (text: string) => {
      const trimmedText = text.trim();
      if (!trimmedText) {
        return;
      }

      // For CHATBOT - use SSE flow
      if (flowType === FlowType.CHATBOT) {
        await saveUserMessage(trimmedText);
        dispatch({ type: "SET_INPUT_TEXT", payload: "" });
        dispatch({ type: "SET_LOADING", payload: true });

        const lastMessage = state.messages[state.messages.length - 1];
        const sessionId =
          lastMessage?.type === "ai" ? lastMessage.sessionId : undefined;
        const conversationId =
          lastMessage?.type === "ai" ? lastMessage.conversationId : undefined;

        await sendChatbotAnswer({
          freeText: trimmedText,
          sessionId,
          conversationId,
        });
        return;
      }

      // For GUIDED FLOWS - use request-response
      const lastAi = await getLastAiMessage();
      if (!lastAi) {
        chatLogger.error("No AI message to respond to");
        return;
      }

      if (!isTextInputMessage(lastAi) && !isDateInputMessage(lastAi)) {
        chatLogger.error("Last message is not a text/date input");
        return;
      }

      await saveUserMessage(trimmedText, lastAi.id);
      dispatch({ type: "SET_INPUT_TEXT", payload: "" });

      if (submitGuidedAnswer) {
        await submitGuidedAnswer({
          nodeId: lastAi.id,
          freeText: trimmedText,
        });
      }
    },
    [
      flowType,
      getLastAiMessage,
      saveUserMessage,
      dispatch,
      state.messages,
      sendChatbotAnswer,
      submitGuidedAnswer,
    ],
  );

  /**
   * Handle date selection
   */
  const handleDateSelect = useCallback(
    async (date: Date) => {
      const lastAi = await getLastAiMessage();
      if (!lastAi) {
        chatLogger.error("No AI message to respond to");
        return;
      }

      const formattedDate = formatDateForApi(date);
      await saveUserMessage(formattedDate, lastAi.id);

      if (isGuidedFlow && submitGuidedAnswer) {
        await submitGuidedAnswer({
          nodeId: lastAi.id,
          freeText: formattedDate,
        });
      }
    },
    [getLastAiMessage, saveUserMessage, isGuidedFlow, submitGuidedAnswer],
  );

  /**
   * Handle Last Menstrual Period (LMP) date selection.
   * Sends the LMP date with a prefix so the backend derives the expected
   * delivery date and marks the user as currently pregnant (NP).
   */
  const handleLmpDateSelect = useCallback(
    async (date: Date) => {
      const lastAi = await getLastAiMessage();
      if (!lastAi) {
        chatLogger.error("No AI message to respond to");
        return;
      }

      const formattedDate = formatDateForApi(date);
      await saveUserMessage(formattedDate, lastAi.id);

      if (isGuidedFlow && submitGuidedAnswer) {
        await submitGuidedAnswer({
          nodeId: lastAi.id,
          freeText: `${LMP_DATE_PREFIX}${formattedDate}`,
        });
      }
    },
    [getLastAiMessage, saveUserMessage, isGuidedFlow, submitGuidedAnswer],
  );

  /**
   * Handle "not pregnant" selection
   */
  const handleNotPregnantSelect = useCallback(async () => {
    const lastAi = await getLastAiMessage();
    if (!lastAi) {
      chatLogger.error("No AI message to respond to");
      return;
    }

    await saveUserMessage(t('chat.notPregnantYet'), lastAi.id);

    if (isGuidedFlow && submitGuidedAnswer) {
      await submitGuidedAnswer({
        nodeId: lastAi.id,
        freeText: NOT_PREGNANT_VALUE,
      });
    }
  }, [getLastAiMessage, saveUserMessage, isGuidedFlow, submitGuidedAnswer]);

  return {
    handleOptionSelect,
    handleMultiSelectSubmit,
    handleTextSubmit,
    handleDateSelect,
    handleLmpDateSelect,
    handleNotPregnantSelect,
  };
};
