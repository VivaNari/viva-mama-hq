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
  IPendingAttachment,
  IUserMessage,
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
import { isGuidedFlowType } from "../utils/flowTypeResolver";
import { chatLogger } from "../utils/logger";
import i18n, { t } from "i18next";
import { AnalyticsEvent, byteSizeBucket, lengthBucket, track } from "../analytics";
import { errorCodeToI18nKey, newUuid, serverErrorCode } from "../utils/attachments";

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
  /** A chatbot turn was accepted by the server; its reply is now awaited. */
  onTurnSent?: (clientMessageId: string, hasAttachments: boolean) => void;
  /** A chatbot turn was refused before it started; its files can be offered again. */
  onSendFailed?: (attachments: IPendingAttachment[], code?: string) => void;
}

/** Refusals after which the same files can simply be sent again. */
const RESENDABLE = new Set(["NETWORK", "NETWORK_TIMEOUT", "QUOTA_EXCEEDED", "LOCKED_FEATURE"]);

export const useChatActions = ({
  state,
  userId,
  flowType,
  dispatch,
  getLastAiMessage,
  saveUserMessage,
  submitGuidedAnswer,
  selectedModel,
  onTurnSent,
  onSendFailed,
}: UseChatActionsProps) => {
  /**
   * Check if this is a guided flow (uses request-response)
   */
  const isGuidedFlow = isGuidedFlowType(flowType);

  /**
   * Send answer for CHATBOT flow (SSE-based)
   */
  const sendChatbotAnswer = useCallback(
    async (payload: {
      freeText?: string;
      sessionId?: string;
      conversationId?: string;
      clientMessageId?: string;
      attachmentIds?: string[];
    }): Promise<{ ok: true } | { ok: false; code?: string; status?: number }> => {
      try {
        await apiClientInterceptor().post(CHAT_FLOW_ANSWER, {
          userId,
          flowInstanceId: "chatbot",
          nodeId: "chatbot",
          freeText: payload.freeText,
          flowType,
          sessionId: payload.sessionId,
          conversationId: payload.conversationId,
          model: selectedModel || "qwen/qwen3-32b",
          clientMessageId: payload.clientMessageId,
          lang: i18n.language,
          ...(payload.attachmentIds?.length ? { attachmentIds: payload.attachmentIds } : {}),
        });
        // Only how long the message was, bucketed — never its text. What a user
        // types to a maternal-health assistant is exactly what must not leave
        // the device.
        track(AnalyticsEvent.CHAT_MESSAGE_SENT, {
          flow_type: flowType ?? undefined,
          length_bucket: lengthBucket(payload.freeText?.length ?? 0),
        });
        return { ok: true };
      } catch (error: any) {
        chatLogger.error("Failed to send chatbot answer", error);
        const code = serverErrorCode(error);
        const status = error.response?.status as number | undefined;
        // 402 opens the paywall from the API client; a toast on top would be noise.
        if (status !== 402) {
          Toast.show({
            type: "error",
            text1: t("common.error", { defaultValue: "Error" }),
            text2: payload.attachmentIds?.length
              ? t(errorCodeToI18nKey(code))
              : error.response?.data?.message || "Failed to send message",
            position: "bottom",
          });
        }
        track(AnalyticsEvent.CHAT_STREAM_FAILED, {
          reason: String(status ?? "network"),
          flow_type: flowType ?? undefined,
        });
        dispatch({ type: "SET_LOADING", payload: false });
        return { ok: false, code: status === 402 ? "QUOTA_EXCEEDED" : code, status };
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
    async (text: string, attachments: IPendingAttachment[] = []) => {
      const trimmedText = text.trim();
      const isChatbot = flowType === FlowType.CHATBOT;
      if (!trimmedText && !(isChatbot && attachments.length)) {
        return;
      }

      // For CHATBOT - use SSE flow
      if (isChatbot) {
        // Keys this turn end to end: a retried POST is recognised, and the reply
        // (over SSE or by polling) is matched back to this bubble.
        const clientMessageId = newUuid();
        const userMessage: IUserMessage = {
          type: "user",
          id: clientMessageId,
          text: trimmedText,
          timestamp: Date.now(),
          status: "sending",
          ...(attachments.length
            ? {
                attachments: attachments.map(a => ({
                  id: a.serverId as string,
                  kind: a.kind,
                  localUri: a.uri,
                  name: a.name,
                  pageCount: a.pageCount,
                  sizeBytes: a.sizeBytes,
                  width: a.width,
                  height: a.height,
                })),
              }
            : {}),
        };
        dispatch({ type: "ADD_MESSAGE", payload: userMessage });
        dispatch({ type: "SET_INPUT_TEXT", payload: "" });
        dispatch({ type: "SET_LOADING", payload: true });

        const lastAi = [...state.messages].reverse().find(m => m.type === "ai") as
          | IAiMessage
          | undefined;
        const sessionId = lastAi?.sessionId || undefined;
        const conversationId = lastAi?.conversationId || undefined;

        const result = await sendChatbotAnswer({
          freeText: trimmedText,
          sessionId,
          conversationId,
          clientMessageId,
          attachmentIds: attachments.map(a => a.serverId as string),
        });
        dispatch({
          type: "UPDATE_USER_MESSAGE",
          payload: { id: clientMessageId, patch: { status: result.ok ? "sent" : "failed" } },
        });
        if (result.ok) {
          if (attachments.length) {
            track(AnalyticsEvent.CHAT_ATTACHMENT_SENT, {
              kind: attachments[0].kind === "PDF" ? "pdf" : "image",
              count: attachments.length,
              size_bucket: byteSizeBucket(
                attachments.reduce((sum, a) => sum + (a.sizeBytes ?? 0), 0),
              ),
              has_caption: trimmedText.length > 0,
            });
          }
          onTurnSent?.(clientMessageId, attachments.length > 0);
        } else if (attachments.length) {
          onSendFailed?.(
            !result.code || RESENDABLE.has(result.code) ? attachments : [],
            result.code,
          );
        }
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
      onTurnSent,
      onSendFailed,
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
