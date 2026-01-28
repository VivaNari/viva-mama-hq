import flowResponseModel from "../../models/flowResponse.model";
import messageModel from "../../models/message.model";
import UserModel from "../../models/user.model";

import {
    IFlowInstance,
    IFlowNode,
    AnswerTypeEnum,
    AnswerData,
    MessageRoleEnum,
    MessageTypeEnum,
} from "../../types/chat.types";
import { IUser } from "../../types";
import { STOPPED_BREASTFEEDING_SCORE } from "../../constants/chat";
import logger from "../../utils/logger";

/**
 * Answer input from user
 */
interface AnswerInput {
    selectedKeys?: number[] | undefined;
    freeText?: string | undefined;
    idempotencyKey?: string;
}

/**
 * Save answer result
 */
interface SaveAnswerResult {
    success: boolean;
    answerData?: AnswerData;
    error?: string;
}

/**
 * AnswerService - Single Responsibility: Process and save user answers
 *
 * Features:
 * - Build answer data from input
 * - Save to flow response with idempotency key
 * - Save user message to conversation
 * - Handle special cases (breastfeeding status)
 */
class AnswerService {
    // ============================================
    // Answer Data Building
    // ============================================

    /**
     * Determine answer type from node and input
     */
    private determineAnswerType(node: IFlowNode, input: AnswerInput): AnswerTypeEnum {
        if (input.freeText) {
            return AnswerTypeEnum.FREE;
        }

        switch (node.nodeType) {
            case "QUESTION_SINGLE":
                return AnswerTypeEnum.SINGLE;
            case "QUESTION_MULTI":
                return AnswerTypeEnum.MULTI;
            default:
                return AnswerTypeEnum.FREE;
        }
    }

    /**
     * Build answer data object
     */
    buildAnswerData(node: IFlowNode, input: AnswerInput): AnswerData {
        const answerType = this.determineAnswerType(node, input);

        return {
            type: answerType,
            selectedKeys: input.freeText ? [] : [...(input.selectedKeys || [])],
            freeText: input.freeText || null,
        };
    }

    /**
     * Get human-readable answer text
     */
    getAnswerText(node: IFlowNode, answerData: AnswerData): string {
        if (answerData.freeText) {
            return answerData.freeText;
        }

        // Map selected keys to option labels
        const selectedLabels = node.options
            .filter((opt) => answerData.selectedKeys?.includes(opt.score!))
            .map((opt) => opt.label);

        return selectedLabels.join(", ") || "No selection";
    }

    // ============================================
    // Answer Persistence
    // ============================================

    /**
     * Save answer to flow response collection
     */
    async saveFlowResponse(
        flowInstance: IFlowInstance,
        nodeId: string,
        answerData: AnswerData,
        idempotencyKey?: string,
    ): Promise<void> {
        await flowResponseModel.create({
            flowInstanceId: flowInstance._id,
            flowDefId: flowInstance.flowDefId,
            nodeId,
            answer: answerData,
            computed: null,
            idempotencyKey, // Store for idempotency checks
        });

        logger.debug(
            { flowInstanceId: flowInstance._id, nodeId, idempotencyKey },
            "Flow response saved",
        );
    }

    /**
     * Save user message to conversation
     */
    async saveUserMessage(
        user: IUser,
        flowInstance: IFlowInstance,
        nodeId: string,
        answerText: string,
        answerData: AnswerData,
    ): Promise<void> {
        await messageModel.create({
            conversationId: flowInstance.conversationId,
            userId: user._id,
            role: MessageRoleEnum.USER,
            type: MessageTypeEnum.GUIDED,
            text: answerText,
            guided: {
                flowInstanceId: flowInstance._id,
                nodeId,
                optionKey: answerData.freeText || answerData.selectedKeys?.join(","),
            },
        });

        logger.debug({ userId: user._id, nodeId, answerText }, "User message saved");
    }

    // ============================================
    // Special Case Handling
    // ============================================

    /**
     * Handle breastfeeding status change
     */
    async handleBreastfeedingStatusChange(
        user: IUser,
        node: IFlowNode,
        answerData: AnswerData,
    ): Promise<boolean> {
        // Only check lactation status indicator
        if (node.indicator !== "Lactation Status") {
            return false;
        }

        // Check if user selected "stopped breastfeeding"
        if (!answerData.selectedKeys?.includes(STOPPED_BREASTFEEDING_SCORE)) {
            return false;
        }

        // Update user record
        await UserModel.findByIdAndUpdate(user._id, {
            is_breastfeeding_currently: false,
        });

        logger.info({ userId: user._id }, "User stopped breastfeeding - updated record");

        return true;
    }

    // ============================================
    // Main Save Method
    // ============================================

    /**
     * Save answer with all related operations
     */
    async saveAnswer(
        user: IUser,
        flowInstance: IFlowInstance,
        node: IFlowNode,
        input: AnswerInput,
    ): Promise<SaveAnswerResult> {
        try {
            // 1. Build answer data
            const answerData = this.buildAnswerData(node, input);

            // 2. Get answer text for message
            const answerText = this.getAnswerText(node, answerData);

            // 3. Save flow response
            await this.saveFlowResponse(flowInstance, node.id, answerData, input.idempotencyKey);

            // 4. Save user message
            await this.saveUserMessage(user, flowInstance, node.id, answerText, answerData);

            // 5. Handle special cases
            await this.handleBreastfeedingStatusChange(user, node, answerData);

            logger.info(
                {
                    userId: user._id,
                    flowInstanceId: flowInstance._id,
                    nodeId: node.id,
                },
                "Answer saved successfully",
            );

            return {
                success: true,
                answerData,
            };
        } catch (error: any) {
            logger.error(
                {
                    error,
                    userId: user._id,
                    flowInstanceId: flowInstance._id,
                    nodeId: node.id,
                },
                "Failed to save answer",
            );

            return {
                success: false,
                error: error.message || "Failed to save answer",
            };
        }
    }

    // ============================================
    // Query Methods
    // ============================================

    /**
     * Get answer for a specific node
     */
    async getAnswer(flowInstanceId: string, nodeId: string): Promise<AnswerData | null> {
        const response = await flowResponseModel.findOne({
            flowInstanceId,
            nodeId,
        });

        return response?.answer || null;
    }

    /**
     * Get all answers for a flow instance
     */
    async getAllAnswers(flowInstanceId: string): Promise<Map<string, AnswerData>> {
        const responses = await flowResponseModel.find({ flowInstanceId });

        const answersMap = new Map<string, AnswerData>();
        for (const response of responses) {
            answersMap.set(response.nodeId, response.answer);
        }

        return answersMap;
    }

    /**
     * Count answered questions
     */
    async getAnsweredCount(flowInstanceId: string): Promise<number> {
        return flowResponseModel.countDocuments({ flowInstanceId });
    }
}

// Export singleton instance
export default AnswerService;
