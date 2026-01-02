import { useCallback, useRef } from "react";
import Toast from "react-native-toast-message";

import apiClientInterceptor from "../api/apiClientInterceptor";
import { GUIDED_FLOW_START, GUIDED_FLOW_ANSWER } from "../constants/endpoints";
import { FlowType, IAiMessage, ChatAction } from "../types/chat.types";
import { chatLogger } from "../utils/logger";

interface UseGuidedFlowProps {
    flowType: FlowType | null;
    flowSlug: string | null;
    dispatch: React.Dispatch<ChatAction>;
    onMessageReceived: (message: IAiMessage) => Promise<void>;
    onFlowComplete: (flowType: FlowType) => Promise<void>;
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
}: UseGuidedFlowProps) => {
    const flowInstanceIdRef = useRef<string | null>(null);
    const weekRef = useRef<number>(1);

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
            freeText?: string;
        }): Promise<boolean> => {
            if (!flowInstanceIdRef.current) {
                chatLogger.error("No flow instance ID");
                return false;
            }

            dispatch({ type: "SET_LOADING", payload: true });

            try {
                const { data } = await apiClientInterceptor().post(GUIDED_FLOW_ANSWER, {
                    flowInstanceId: flowInstanceIdRef.current,
                    nodeId: payload.nodeId,
                    week: weekRef.current,
                    selectedKeys: payload.selectedKeys,
                    freeText: payload.freeText,
                    idempotencyKey: `${flowInstanceIdRef.current}-${payload.nodeId}-${Date.now()}`,
                });

                if (!data.success) {
                    throw new Error(data.message || "Failed to submit answer");
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
                    if (flowType) {
                        await onFlowComplete(flowType);
                    }
                    return true;
                }

                if (data.data.nextQuestion) {
                    const aiMessage = toAiMessage(data.data.nextQuestion);
                    await onMessageReceived(aiMessage);
                }

                return true;
            } catch (error: any) {
                chatLogger.error("Failed to submit answer", error);
                Toast.show({
                    type: "error",
                    text1: "Error",
                    text2: error.response?.data?.message || "Failed to submit",
                    position: "bottom",
                });
                dispatch({ type: "SET_LOADING", payload: false });
                return false;
            }
        },
        [flowType, dispatch, onMessageReceived, onFlowComplete, toAiMessage]
    );

    /**
     * Start/Resume the guided flow
     * Backend handles both new flows and resuming existing ones
     */
    const initialize = useCallback(async () => {
        if (!flowSlug) {
            chatLogger.warn("Cannot start flow: missing flowSlug");
            return;
        }

        dispatch({ type: "SET_LOADING", payload: true });

        try {
            const { data } = await apiClientInterceptor().post(GUIDED_FLOW_START, {
                flowSlug,
                week: weekRef.current,
            });

            if (!data.success) {
                throw new Error(data.message || "Failed to start flow");
            }

            flowInstanceIdRef.current = data.data.flowInstanceId;
            weekRef.current = data.data.week;

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
            Toast.show({
                type: "error",
                text1: "Error",
                text2: error.response?.data?.message || "Failed to start",
                position: "bottom",
            });
            dispatch({ type: "SET_LOADING", payload: false });
        }
    }, [flowSlug, flowType, dispatch, onMessageReceived, onFlowComplete, toAiMessage]);

    return {
        initialize,
        submitAnswer,
        flowInstanceId: flowInstanceIdRef.current,
    };
};