import { useCallback } from "react";
import Toast from "react-native-toast-message";

import apiClientInterceptor from "../api/apiClientInterceptor";
import {
  CHAT_FLOW_ANSWER,
  WEEKLY_CHECKIN_ANSWER,
} from "../constants/endpoints";
import {
  FlowType,
  IOption,
  IAiMessage,
  ChatAction,
  ChatState,
} from "../types/chat.types";
import { NOT_PREGNANT_VALUE } from "../constants/chat";
import {
  formatDateForApi,
  getSelectedLabels,
  getSelectedScores,
  isTextInputMessage,
  isDateInputMessage,
} from "../utils/messageHelpers";
import { chatLogger } from "../utils/logger";

interface UseChatActionsProps {
  state: ChatState;
  userId: string | null;
  flowType: FlowType | null;
  dispatch: React.Dispatch<ChatAction>;
  getLastAiMessage: () => Promise<IAiMessage | null>;
  saveUserMessage: (text: string, lastAiMessageId?: string) => Promise<void>;
}

export const useChatActions = ({
  state,
  userId,
  flowType,
  dispatch,
  getLastAiMessage,
  saveUserMessage,
}: UseChatActionsProps) => {
  const sendAnswer = useCallback(
    async (payload: {
      flowInstanceId: string;
      nodeId: string;
      selectedKeys?: number[];
      freeText?: string;
      sessionId?: string;
      conversationId?: string;
    }): Promise<boolean> => {
      try {
        if (flowType === FlowType.CHECKIN) {
          await apiClientInterceptor().post(WEEKLY_CHECKIN_ANSWER, {
            userId,
            flowInstanceId: payload.flowInstanceId,
            nodeId: payload.nodeId,
            selectedKeys: payload.selectedKeys,
            freeText: payload.freeText,
            flowType,
            week: 1,
            idempotencyKey: payload.nodeId,
          });
        } else {
          await apiClientInterceptor().post(CHAT_FLOW_ANSWER, {
            userId,
            flowInstanceId: payload.flowInstanceId,
            nodeId: payload.nodeId,
            selectedKeys: payload.selectedKeys,
            freeText: payload.freeText,
            flowType,
            sessionId: payload.sessionId,
            conversationId: payload.conversationId,
          });
        }
        return true;
      } catch (error: any) {
        chatLogger.error("Failed to send answer", error);
        Toast.show({
          type: "error",
          text1: "Error",
          text2: error.response?.data?.message || "Failed to send answer",
          position: "bottom",
        });
        dispatch({ type: "SET_LOADING", payload: false });
        return false;
      }
    },
    [userId, flowType, dispatch],
  );

  const handleOptionSelect = useCallback(
    async (option: IOption) => {
      const lastAi = await getLastAiMessage();
      if (!lastAi) {
        chatLogger.error("No AI message to respond to");
        return;
      }

      await saveUserMessage(option.label, lastAi.id);
      dispatch({ type: "SET_LOADING", payload: true });

      await sendAnswer({
        flowInstanceId: lastAi.flowInstanceId,
        nodeId: lastAi.id,
        selectedKeys: [option.score],
      });
    },
    [getLastAiMessage, saveUserMessage, sendAnswer, dispatch],
  );

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

      await saveUserMessage(selectedLabels, lastAi.id);
      dispatch({ type: "CLEAR_MULTI_OPTIONS" });
      dispatch({ type: "SET_LOADING", payload: true });

      await sendAnswer({
        flowInstanceId: lastAi.flowInstanceId,
        nodeId: lastAi.id,
        selectedKeys: selectedScores,
      });
    },
    [getLastAiMessage, saveUserMessage, sendAnswer, dispatch],
  );

  const handleTextSubmit = useCallback(
    async (text: string) => {
      const trimmedText = text.trim();
      if (!trimmedText) {
        return;
      }

      // For chatbot, we don't need the last AI message
      if (flowType === FlowType.CHATBOT) {
        await saveUserMessage(trimmedText);
        dispatch({ type: "SET_INPUT_TEXT", payload: "" });
        dispatch({ type: "SET_LOADING", payload: true });

        const lastMessage = state.messages[state.messages.length - 1];
        const sessionId =
          lastMessage.type === "ai" ? lastMessage.sessionId : undefined;
        const conversationId =
          lastMessage.type === "ai" ? lastMessage.conversationId : undefined;

        await sendAnswer({
          flowInstanceId: "chatbot",
          nodeId: "chatbot",
          freeText: trimmedText,
          sessionId: sessionId,
          conversationId: conversationId,
        });
        return;
      }

      // For guided flows
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
      dispatch({ type: "SET_LOADING", payload: true });

      await sendAnswer({
        flowInstanceId: lastAi.flowInstanceId,
        nodeId: lastAi.id,
        freeText: trimmedText,
      });
    },
    [flowType, getLastAiMessage, saveUserMessage, sendAnswer, dispatch, state],
  );

  const handleDateSelect = useCallback(
    async (date: Date) => {
      const lastAi = await getLastAiMessage();
      if (!lastAi) {
        chatLogger.error("No AI message to respond to");
        return;
      }

      const formattedDate = formatDateForApi(date);

      await saveUserMessage(formattedDate, lastAi.id);
      dispatch({ type: "SET_LOADING", payload: true });

      await sendAnswer({
        flowInstanceId: lastAi.flowInstanceId,
        nodeId: lastAi.id,
        freeText: formattedDate,
      });
    },
    [getLastAiMessage, saveUserMessage, sendAnswer, dispatch],
  );

  const handleNotPregnantSelect = useCallback(async () => {
    const lastAi = await getLastAiMessage();
    if (!lastAi) {
      chatLogger.error("No AI message to respond to");
      return;
    }

    await saveUserMessage("I'm not pregnant yet", lastAi.id);
    dispatch({ type: "SET_LOADING", payload: true });

    await sendAnswer({
      flowInstanceId: lastAi.flowInstanceId,
      nodeId: lastAi.id,
      freeText: NOT_PREGNANT_VALUE,
    });
  }, [getLastAiMessage, saveUserMessage, sendAnswer, dispatch]);

  return {
    handleOptionSelect,
    handleMultiSelectSubmit,
    handleTextSubmit,
    handleDateSelect,
    handleNotPregnantSelect,
  };
};
