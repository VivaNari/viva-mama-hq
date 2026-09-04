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
import { getOrCreateFlowConversation } from "../chat-system/flow-conversation.service";
import { calculatePostpartumState } from "../../utils/functions/postpartumWeek";

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
     * The user's week right now, computed from her delivery date rather than read from
     * `current_weekdays.weeks`.
     *
     * The stored value is only written by the nightly job, so trusting it made every
     * check-in request depend on that job having run. A failed or delayed run left the
     * stored week behind the real one and the start endpoint then rejected the current
     * week as "not triggered yet". Deriving it here keeps the request path correct on its
     * own; the stored copy exists for the app to render, not for the server to gate on.
     */
    private currentWeekOf(user: IUser): number {
        const deliveryDate = user.onboarding_data?.delivery_date;
        if (!deliveryDate) return user.current_weekdays?.weeks || 0;

        const state = calculatePostpartumState(deliveryDate as Date);
        return state.mode === "postpartum" ? state.weeks : 0;
    }

    /**
     * Validate week against user's current week
     */
    validateWeekForUser(week: number, user: IUser): { isValid: boolean; error?: string } {
        const userCurrentWeek = this.currentWeekOf(user);

        // Exactly the current week — a check-in is open for the whole of its week and
        // closes when that week ends.
        //
        // There used to be a MAX_RETROACTIVE_WEEKS = 4 allowance here, but it never did
        // anything: the week job marks past weeks EXPIRED and the state check below
        // rejects EXPIRED, so a retroactive week was refused a few lines later anyway.
        // Config that claims a capability the system does not have is worse than no
        // config. Supporting a real backfill window needs the score engine to take the
        // week from the flow instance rather than from `user.current_weekdays`.
        if (week > userCurrentWeek) {
            return {
                isValid: false,
                error: WEEKLY_CHECKIN_MESSAGES.NOT_TRIGGERED,
            };
        }

        if (week < userCurrentWeek) {
            return {
                isValid: false,
                error: WEEKLY_CHECKIN_MESSAGES.EXPIRED,
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

        // 2. Validate week for user — check-in only.
        //
        // Onboarding runs through this same method but is not week-scoped: it sends
        // whatever is in current_weekdays, which for a pregnant user is her GESTATIONAL
        // week. Gating that against a postpartum week is meaningless, and rejects her
        // outright once she has entered a delivery date.
        if (flowSlug === WEEKLY_CHECKIN_SLUG) {
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
            // Check expiration first.
            // The 7-day expiry only applies to weekly check-ins. This endpoint is a
            // shared guided-flow engine (onboarding uses it too), so non-check-in
            // flows must never be expired here.
            if (
                flowSlug === WEEKLY_CHECKIN_SLUG &&
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

        // 6. No existing instance. Normal, not exceptional: the week job may not have run
        // yet, or she upgraded from FREE mid-week — FREE users get no instance created,
        // so the first one she is entitled to has to be made here.

        // Only create on demand for the check-in flow; onboarding reaches this method
        // with a gestational week that means nothing here.
        if (flowSlug === WEEKLY_CHECKIN_SLUG) {
            const weekCheck = this.validateWeekForUser(week, user);
            if (!weekCheck.isValid) {
                return {
                    isValid: false,
                    error: {
                        type: WeeklyCheckinErrorType.WEEK_MISMATCH,
                        message: weekCheck.error!,
                    },
                };
            }
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
        // Keyed on the flow being started, NOT hardcoded to the check-in. This method
        // serves onboarding too, and asking for the "check-in" conversation regardless
        // meant onboarding created one titled "Weekly Check-in" — which the first real
        // check-in then found and reused, merging both flows into one thread.
        const conversation = await getOrCreateFlowConversation(user, flowDefinition.slug);

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

        // 5. Check expiration (only for new answers, and only for the check-in flow).
        // Onboarding answers also flow through this endpoint, so gate on the
        // instance's own slug to avoid expiring non-check-in flows.
        if (flowInstance.flowSlug === WEEKLY_CHECKIN_SLUG && this.isExpired(flowInstance)) {
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
