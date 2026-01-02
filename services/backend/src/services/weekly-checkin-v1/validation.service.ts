import flowDefinitionModel from "../../models/flowDefinition.model";
import flowInstanceModel from "../../models/flowInstance.model";
import flowResponseModel from "../../models/flowResponse.model";

import {
    IFlowDefinition,
    IFlowInstance,
    FlowInstanceStateEnum,
    WeeklyCheckinValidation,
    WeeklyCheckinErrorType,
    WeeklyCheckinState,
} from "../../types/chat.types";
import { IUser } from "../../types";
import {
    WEEKLY_CHECKIN_SLUG,
    WEEKLY_CHECKIN_MESSAGES,
    CHECKIN_EXPIRY_DAYS,
} from "../../constants/chat";
import logger from "../../utils/logger";
import conversationModel from "../../models/conversation.model";

interface IdempotencyCheckResult {
    isDuplicate: boolean;
    existingResponse?: any;
}

/**
 * ValidationService - Single Responsibility: Validate check-in requests
 *
 * Features:
 * - Week validation
 * - Expiration logic
 * - Idempotency checks (checked FIRST for retry safety)
 * - Flow instance state validation
 */
class ValidationService {
    // Configuration
    private readonly MAX_RETROACTIVE_WEEKS = 4; // Can complete check-ins up to 4 weeks old
    private readonly MIN_WEEK = 1;
    private readonly MAX_WEEK = 52;

    // ============================================
    // Week Validation
    // ============================================

    /**
     * Validate week parameter
     */
    validateWeekParam(week: number): { isValid: boolean; error?: string } {
        if (isNaN(week) || !Number.isInteger(week)) {
            return { isValid: false, error: "Week must be a valid integer" };
        }

        if (week < this.MIN_WEEK || week > this.MAX_WEEK) {
            return {
                isValid: false,
                error: `Week must be between ${this.MIN_WEEK} and ${this.MAX_WEEK}`,
            };
        }

        return { isValid: true };
    }

    /**
     * Validate week against user's current week
     */
    validateWeekForUser(week: number, user: IUser): { isValid: boolean; error?: string } {
        const userCurrentWeek = user.current_weekdays?.weeks || 0;

        // Cannot do check-in for future weeks
        if (week > userCurrentWeek) {
            return {
                isValid: false,
                error: WEEKLY_CHECKIN_MESSAGES.NOT_TRIGGERED,
            };
        }

        // Cannot do check-in for weeks too far in the past
        if (week < userCurrentWeek - this.MAX_RETROACTIVE_WEEKS) {
            return {
                isValid: false,
                error: `Cannot complete check-in for weeks more than ${this.MAX_RETROACTIVE_WEEKS} weeks old`,
            };
        }

        return { isValid: true };
    }

    // ============================================
    // Expiration Logic
    // ============================================

    /**
     * Check if a flow instance has expired
     */
    isExpired(flowInstance: IFlowInstance): boolean {
        if (!flowInstance.createdAt) {
            return false;
        }

        const createdAt = new Date(flowInstance.createdAt).getTime();
        const now = Date.now();
        const daysSinceCreated = Math.floor((now - createdAt) / (1000 * 60 * 60 * 24));

        return daysSinceCreated > CHECKIN_EXPIRY_DAYS;
    }

    /**
     * Mark flow instance as expired
     */
    async markAsExpired(flowInstance: IFlowInstance): Promise<void> {
        await flowInstanceModel.findByIdAndUpdate(flowInstance._id, {
            state: WeeklyCheckinState.EXPIRED,
        });

        logger.info(
            { flowInstanceId: flowInstance._id, week: flowInstance.postpartumWeek },
            "Flow instance marked as expired",
        );
    }

    /**
     * Get days until expiration
     */
    getDaysUntilExpiration(flowInstance: IFlowInstance): number {
        if (!flowInstance.createdAt) {
            return CHECKIN_EXPIRY_DAYS;
        }

        const createdAt = new Date(flowInstance.createdAt).getTime();
        const now = Date.now();
        const daysSinceCreated = Math.floor((now - createdAt) / (1000 * 60 * 60 * 24));

        return Math.max(0, CHECKIN_EXPIRY_DAYS - daysSinceCreated);
    }

    // ============================================
    // Idempotency Checks
    // ============================================

    /**
     * Check if answer has already been processed (idempotency)
     * Uses combination of flowInstanceId + nodeId + answer hash
     */
    async checkIdempotency(
        flowInstanceId: string,
        nodeId: string,
        idempotencyKey?: string,
    ): Promise<IdempotencyCheckResult> {
        // If idempotency key provided, check by key
        if (idempotencyKey) {
            const existingResponse = await flowResponseModel.findOne({
                flowInstanceId,
                nodeId,
                idempotencyKey,
            });

            if (existingResponse) {
                logger.info(
                    { flowInstanceId, nodeId, idempotencyKey },
                    "Duplicate request detected via idempotency key",
                );
                return { isDuplicate: true, existingResponse };
            }
        }

        // Also check if answer already exists for this node
        // This handles retries even without idempotency key
        const existingAnswer = await flowResponseModel.findOne({
            flowInstanceId,
            nodeId,
        });

        if (existingAnswer) {
            logger.info({ flowInstanceId, nodeId }, "Answer already exists for this node");
            return { isDuplicate: true, existingResponse: existingAnswer };
        }

        return { isDuplicate: false };
    }

    // ============================================
    // Flow Instance Validation
    // ============================================

    /**
     * Validate cursor position
     */
    validateCursorPosition(
        flowInstance: IFlowInstance,
        nodeId: string,
    ): { isValid: boolean; error?: string } {
        if (flowInstance.cursorNodeId !== nodeId) {
            return {
                isValid: false,
                error: `Wrong question. Expected: ${flowInstance.cursorNodeId}, Got: ${nodeId}`,
            };
        }
        return { isValid: true };
    }

    /**
     * Validate flow instance state
     */
    validateFlowInstanceState(flowInstance: IFlowInstance | null): {
        isValid: boolean;
        error?: string;
        errorType?: WeeklyCheckinErrorType;
    } {
        if (!flowInstance) {
            return {
                isValid: false,
                error: "Flow instance not found",
                errorType: WeeklyCheckinErrorType.INSTANCE_NOT_FOUND,
            };
        }

        if (flowInstance.state === FlowInstanceStateEnum.COMPLETED) {
            return {
                isValid: false,
                error: WEEKLY_CHECKIN_MESSAGES.ALREADY_COMPLETED,
                errorType: WeeklyCheckinErrorType.ALREADY_COMPLETED,
            };
        }

        if (flowInstance.state === FlowInstanceStateEnum.EXPIRED) {
            return {
                isValid: false,
                error: WEEKLY_CHECKIN_MESSAGES.EXPIRED,
                errorType: WeeklyCheckinErrorType.WEEK_MISMATCH,
            };
        }

        return { isValid: true };
    }

    // ============================================
    // Comprehensive Validation
    // ============================================

    /**
     * Validate and get flow instance for starting check-in
     */
    async validateSSERequest(
        user: IUser,
        week: number,
        flowSlug: string = WEEKLY_CHECKIN_SLUG,
    ): Promise<WeeklyCheckinValidation> {
        // 1. Validate week parameter
        const weekParamValidation = this.validateWeekParam(week);
        if (!weekParamValidation.isValid) {
            return {
                isValid: false,
                error: {
                    type: WeeklyCheckinErrorType.WEEK_MISMATCH,
                    message: weekParamValidation.error!,
                },
            };
        }

        // 2. Validate week for user
        const weekUserValidation = this.validateWeekForUser(week, user);
        if (!weekUserValidation.isValid) {
            return {
                isValid: false,
                error: {
                    type: WeeklyCheckinErrorType.WEEK_MISMATCH,
                    message: weekUserValidation.error!,
                },
            };
        }

        // 3. Get flow definition
        const flowDefinition = await flowDefinitionModel.findOne({
            slug: flowSlug,
            status: "PUBLISHED",
        });

        if (!flowDefinition) {
            return {
                isValid: false,
                error: {
                    type: WeeklyCheckinErrorType.FLOW_NOT_FOUND,
                    message: WEEKLY_CHECKIN_MESSAGES.FLOW_NOT_FOUND,
                },
            };
        }

        // 4. Check for existing flow instance
        const existingInstance = await flowInstanceModel.findOne({
            userId: user._id,
            flowDefId: flowDefinition._id,
            postpartumWeek: week,
        });

        // 5. Handle different states
        if (existingInstance) {
            // Check expiration first
            if (
                this.isExpired(existingInstance) &&
                existingInstance.state !== FlowInstanceStateEnum.COMPLETED
            ) {
                await this.markAsExpired(existingInstance);
                return {
                    isValid: false,
                    error: {
                        type: WeeklyCheckinErrorType.WEEK_MISMATCH,
                        message: WEEKLY_CHECKIN_MESSAGES.EXPIRED,
                    },
                };
            }

            // Validate state
            const stateValidation = this.validateFlowInstanceState(existingInstance);
            if (!stateValidation.isValid) {
                return {
                    isValid: false,
                    error: {
                        type: stateValidation.errorType!,
                        message: stateValidation.error!,
                    },
                };
            }

            // Activate if pending
            if (existingInstance.state === FlowInstanceStateEnum.PENDING) {
                existingInstance.state = FlowInstanceStateEnum.ACTIVE;
                await existingInstance.save();
            }

            return {
                isValid: true,
                flowInstance: existingInstance,
            };
        }

        // 6. No existing instance - this is only valid if cron hasn't triggered yet
        // but user's week matches (edge case: manual check-in start)

        const userCurrentWeek = user.current_weekdays?.weeks || 0;
        if (week > userCurrentWeek) {
            return {
                isValid: false,
                error: {
                    type: WeeklyCheckinErrorType.WEEK_MISMATCH,
                    message: WEEKLY_CHECKIN_MESSAGES.NOT_TRIGGERED,
                },
            };
        }

        if (week < userCurrentWeek - this.MAX_RETROACTIVE_WEEKS) {
            return {
                isValid: false,
                error: {
                    type: WeeklyCheckinErrorType.WEEK_MISMATCH,
                    message: `Cannot complete check-in for weeks more than ${this.MAX_RETROACTIVE_WEEKS} weeks old`,
                },
            };
        }

        const newInstance = await this.createFlowInstance(user, week, flowDefinition);

        return {
            isValid: true,
            flowInstance: newInstance,
        };
    }

    private async createFlowInstance(
        user: IUser,
        week: number,
        flowDefinition: IFlowDefinition,
    ): Promise<IFlowInstance> {
        // Get or create conversation
        let conversation = await conversationModel.findOne({
            userId: user._id,
            chatMode: "GUIDED_ONLY",
            "meta.tags": "check-in",
        });

        if (!conversation) {
            conversation = await conversationModel.create({
                userId: user._id,
                title: "Weekly Check-in",
                chatMode: "GUIDED_ONLY",
                lastMessageAt: new Date(),
                meta: {
                    channel: "App",
                    tags: ["check-in"],
                },
            });
        }

        // Create flow instance (ACTIVE since user is starting it now)
        const newInstance = await flowInstanceModel.create({
            userId: user._id,
            conversationId: conversation._id,
            flowDefId: flowDefinition._id,
            flowSlug: flowDefinition.slug,
            version: flowDefinition.version,
            postpartumWeek: week,
            state: FlowInstanceStateEnum.ACTIVE, // ACTIVE, not PENDING
            cursorNodeId: flowDefinition.startNodeId,
            variables: {},
            outcome: null,
        });

        logger.info(
            { userId: user._id, week, flowInstanceId: newInstance._id },
            "Created flow instance on-demand",
        );

        return newInstance;
    }

    /**
     * Validate answer submission request
     *
     * IMPORTANT: Idempotency check happens BEFORE cursor validation
     * to properly handle frontend retries after timeout.
     *
     * Flow:
     * 1. Check flow instance exists
     * 2. Check idempotency (FIRST - handles retries)
     * 3. Validate state (only for new answers)
     * 4. Check expiration (only for new answers)
     * 5. Validate cursor (only for new answers)
     */
    async validateAnswerRequest(
        userId: string,
        flowInstanceId: string,
        nodeId: string,
        week: number,
        idempotencyKey?: string,
    ): Promise<{
        isValid: boolean;
        error?: string | undefined;
        errorType?: WeeklyCheckinErrorType | undefined;
        flowInstance?: IFlowInstance;
        isDuplicate?: boolean;
    }> {
        // 1. Get flow instance
        const flowInstance = await flowInstanceModel.findOne({
            _id: flowInstanceId,
            userId,
            postpartumWeek: week,
        });

        // 2. Validate flow instance exists
        if (!flowInstance) {
            return {
                isValid: false,
                error: "Flow instance not found",
                errorType: WeeklyCheckinErrorType.INSTANCE_NOT_FOUND,
            };
        }

        // 3. Check idempotency FIRST (before other validations)
        // This ensures retries work correctly even if:
        // - Cursor has already moved to next question
        // - Original request succeeded but client didn't receive response
        const idempotencyCheck = await this.checkIdempotency(
            flowInstanceId,
            nodeId,
            idempotencyKey,
        );

        if (idempotencyCheck.isDuplicate) {
            logger.info(
                { flowInstanceId, nodeId, idempotencyKey, userId },
                "Duplicate answer detected - returning success for retry safety",
            );
            return {
                isValid: true, // Not an error, already processed successfully
                isDuplicate: true,
                flowInstance: flowInstance,
            };
        }

        // 4. Validate flow instance state (only for new answers)
        const stateValidation = this.validateFlowInstanceState(flowInstance);
        if (!stateValidation.isValid) {
            return {
                isValid: false,
                error: stateValidation.error,
                errorType: stateValidation.errorType,
            };
        }

        // 5. Check expiration (only for new answers)
        if (this.isExpired(flowInstance)) {
            await this.markAsExpired(flowInstance);
            return {
                isValid: false,
                error: WEEKLY_CHECKIN_MESSAGES.EXPIRED,
                errorType: WeeklyCheckinErrorType.WEEK_MISMATCH,
            };
        }

        // 6. Validate cursor position (only for new answers)
        const cursorValidation = this.validateCursorPosition(flowInstance, nodeId);
        if (!cursorValidation.isValid) {
            return {
                isValid: false,
                error: cursorValidation.error,
                errorType: WeeklyCheckinErrorType.INVALID_NODE,
            };
        }

        return {
            isValid: true,
            isDuplicate: false,
            flowInstance: flowInstance,
        };
    }
}

// Export singleton instance
export const validationService = new ValidationService();

// Export class for testing
export { ValidationService };
