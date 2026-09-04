import { Schema } from "mongoose";

import flowInstanceModel from "../../models/flowInstance.model";
import flowResponseModel from "../../models/flowResponse.model";
import messageModel from "../../models/message.model";
import UserModel from "../../models/user.model";

import {
    WeeklyCheckinStartParams,
    WeeklyCheckinAnswerParams,
    WeeklyCheckinResponse,
    WeeklyCheckinStateEnum,
    WeeklyCheckinQuestionPayload,
    WeeklyCheckinErrorTypeEnum,
} from "../../types/weekly-checkin-v1.types";

import {
    IFlowDefinition,
    IFlowInstance,
    IFlowNode,
    FlowInstanceStateEnum,
    MessageRoleEnum,
    MessageTypeEnum,
    FlowLanguage,
    DEFAULT_FLOW_LANGUAGE,
} from "../../types/chat.types";
import { resolveLanguage } from "../../utils/i18n/localizeFlowDefinition";
import { IUser, DeliveryOutcomeEnum } from "../../types/user.types";
import { ESubscriptionTier } from "../../types/subscription.types";
import {
    WEEKLY_CHECKIN_SLUG,
    WEEKLY_CHECKIN_MESSAGES,
    getFlowCompletionMessage,
    getStillBirthAckMessage,
} from "../../constants/chat";

// Import SRP services
import { validationService } from "./validation.service";
import FlowService from "./flow.service";
import AnswerService from "./answer.service";
import ScorePublisherService from "./scorePublisher.service";
import NotificationService from "./notification.service";

import { getUuid } from "../../utils/commonFunctions/uuid";
import logger from "../../utils/logger";
import ChatFlowService from "../chat-system/chat-flow.service";
import { getOrCreateFlowConversation } from "../chat-system/flow-conversation.service";

/**
 * Question response format
 */
interface QuestionPayload {
    id: string;
    flowInstanceId: string;
    week: number;
    text: string;
    educationalMessage: string;
    whyThisMatters: string;
    options: Array<{
        id: string;
        label: string;
        value: string;
        score: number;
    }>;
    nodeType: string;
}

/**
 * Check-in status response
 */
interface CheckinStatus {
    week: number;
    hasCheckin: boolean;
    state: string | null;
    isCompleted: boolean;
    isExpired: boolean;
    progress: {
        answered: number;
        total: number;
    } | null;
}

/**
 * Current state response
 */
interface CurrentStateResponse {
    hasActiveCheckin: boolean;
    flowInstanceId: string | null;
    week: number;
    state: string | null;
    currentQuestion: QuestionPayload | null;
    progress: {
        answered: number;
        total: number;
    } | null;
}

/**
 * WeeklyCheckinService - Orchestrator (Request-Response Version)
 *
 * Single Responsibility: Coordinate all check-in operations
 *
 * Delegates to:
 * - ValidationService: Request validation & idempotency
 * - FlowService: Node eligibility & flow navigation
 * - AnswerService: Answer persistence
 * - ScorePublisherService: Score calculation trigger
 * - NotificationService: Push notifications
 */
class WeeklyCheckinService {
    private answerService: AnswerService;
    private flowService: FlowService;
    private notificationService: NotificationService;
    private scorePublisherService: ScorePublisherService;
    private chatFlowService: ChatFlowService;

    constructor() {
        this.answerService = new AnswerService();
        this.flowService = new FlowService();
        this.notificationService = new NotificationService();
        this.scorePublisherService = new ScorePublisherService();
        this.chatFlowService = new ChatFlowService();
    }

    // ============================================
    // Start Check-in
    // ============================================

    /**
     * Start a weekly check-in session
     * Returns the first question
     */
    async startCheckin(params: WeeklyCheckinStartParams): Promise<WeeklyCheckinResponse> {
        const { userId, week, flowSlug } = params;

        try {
            // 1. Get user
            const user = await UserModel.findById(userId);
            if (!user) {
                return {
                    success: false,
                    message: "User not found",
                    errorType: WeeklyCheckinErrorTypeEnum.INSTANCE_NOT_FOUND,
                };
            }

            const lang = resolveLanguage(params.lang, user.preferred_language);

            logger.info({ userId, week, flowSlug, lang }, "Starting weekly check-in");

            // 2. Validate and get/create flow instance
            const validation = await validationService.validateSSERequest(user, week, flowSlug);

            if (!validation.isValid || !validation.flowInstance) {
                return {
                    success: false,
                    message: validation.error?.message || "Validation failed",
                    errorType: validation.error?.type as unknown as WeeklyCheckinErrorTypeEnum,
                };
            }

            const flowInstance = validation.flowInstance;

            // 3. Get flow definition (localized for the user's language)
            const flowDefinition = await this.flowService.getFlowDefinitionById(
                flowInstance.flowDefId.toString(),
                lang,
            );

            if (!flowDefinition) {
                return {
                    success: false,
                    message: WEEKLY_CHECKIN_MESSAGES.FLOW_NOT_FOUND,
                    errorType: WeeklyCheckinErrorTypeEnum.FLOW_NOT_FOUND,
                };
            }

            // 4. Get first question
            const questionResult = await this.getNextQuestion(
                user,
                flowInstance,
                flowDefinition,
                week,
            );

            if (!questionResult.question) {
                // Flow is already complete (edge case)
                return {
                    success: true,
                    message: "Check-in already completed",
                    data: {
                        flowInstanceId: flowInstance._id.toString(),
                        week,
                        isCompleted: true,
                        nextQuestion: null,
                        progress: await this.getProgress(
                            flowInstance._id.toString(),
                            flowDefinition,
                        ),
                    },
                };
            }

            // 5. Save AI message for the question
            await this.saveQuestionMessage(user, flowInstance, questionResult.question);

            logger.info(
                {
                    userId,
                    week,
                    flowInstanceId: flowInstance._id,
                    nodeId: questionResult.question.id,
                },
                "Check-in started, first question sent",
            );

            return {
                success: true,
                message: "Check-in started",
                data: {
                    flowInstanceId: flowInstance._id.toString(),
                    week,
                    isCompleted: false,
                    nextQuestion: questionResult.question,
                    progress: await this.getProgress(flowInstance._id.toString(), flowDefinition),
                },
            };
        } catch (error: any) {
            console.error("errr", error);
            logger.error({ error, userId, week }, "Error starting check-in");
            return {
                success: false,
                message: "Failed to start check-in",
            };
        }
    }

    // ============================================
    // Answer Processing
    // ============================================

    /**
     * Process user's answer and return next question
     */
    async processAnswer(params: WeeklyCheckinAnswerParams): Promise<WeeklyCheckinResponse> {
        const {
            userId,
            flowInstanceId,
            nodeId,
            week,
            selectedKeys,
            selectedValues,
            idempotencyKey,
        } = params;
        let { freeText } = params;

        try {
            // 1. Validate inputs
            if (!selectedValues?.length && !selectedKeys?.length && !freeText) {
                return {
                    success: false,
                    message: "Either selectedValues, selectedKeys or freeText must be provided",
                };
            }

            // 2. Get user
            const user = await UserModel.findById(userId);
            if (!user) {
                return { success: false, message: "User not found" };
            }

            const lang = resolveLanguage(params.lang, user.preferred_language);

            // 3. Validate request (includes idempotency check)
            const validation = await validationService.validateAnswerRequest(
                userId,
                flowInstanceId,
                nodeId,
                week,
                idempotencyKey,
            );

            if (!validation.isValid) {
                return {
                    success: false,
                    message: validation.error || "Validation failed",
                    errorType: validation.errorType as unknown as WeeklyCheckinErrorTypeEnum,
                };
            }

            // 4. Get flow definition (localized for the user's language)
            const flowInstance = validation.flowInstance!;
            const flowDefinition = await this.flowService.getFlowDefinitionById(
                flowInstance.flowDefId.toString(),
                lang,
            );

            if (!flowDefinition) {
                return { success: false, message: "Flow definition not found" };
            }

            // 5. Handle duplicate (idempotent response)
            if (validation.isDuplicate) {
                logger.info(
                    { userId, nodeId, idempotencyKey },
                    "Duplicate request - returning current state",
                );

                // Fetch FRESH flow instance to get current cursor position
                // (cursor may have moved after original answer was processed)
                const freshFlowInstance = await this.flowService.getFlowInstance(flowInstanceId);

                if (!freshFlowInstance) {
                    return { success: false, message: "Flow instance not found" };
                }

                // Check if flow is already completed
                if (freshFlowInstance.state === FlowInstanceStateEnum.COMPLETED) {
                    return {
                        success: true,
                        message: "Check-in already completed",
                        data: {
                            flowInstanceId,
                            week,
                            isCompleted: true,
                            nextQuestion: null,
                            progress: await this.getProgress(flowInstanceId, flowDefinition),
                        },
                    };
                }

                // Return current state (next question after the duplicate)
                const questionResult = await this.getNextQuestion(
                    user,
                    freshFlowInstance,
                    flowDefinition,
                    week,
                );

                return {
                    success: true,
                    message: "Already processed",
                    data: {
                        flowInstanceId,
                        week,
                        isCompleted: !questionResult.question,
                        nextQuestion: questionResult.question,
                        progress: await this.getProgress(flowInstanceId, flowDefinition),
                    },
                };
            }

            // 6. Get current node
            const currentNode = this.flowService.getNode(flowDefinition, nodeId);
            if (!currentNode) {
                return { success: false, message: "Node not found" };
            }

            // 7. Save answer
            const saveResult = await this.answerService.saveAnswer(
                user,
                flowInstance,
                currentNode,
                {
                    selectedKeys,
                    selectedValues,
                    freeText,
                    idempotencyKey,
                },
            );

            // SPECIAL VALIDATION FOR NAME NODE
            // console.log(` Checking special validations for node ${nodeId}`);
            // if (/*flowType === "ONBOARDING" &&*/ nodeId === "name") {
            //     // 1. Call your LLM API to validate name
            //     const llmRes = await axios.post(
            //         `http://192.168.1.15:8001/v1/chat/username`,
            //         { response: freeText || "" },
            //         {
            //             headers: {
            //                 "x-api-key": env.LLM_API_KEY,
            //             },
            //         },
            //     );
            //     console.log(` LLM response: ${JSON.stringify(llmRes.data)}`);
            //     const { detected_name, has_name } = llmRes.data;

            //     if (!has_name) {
            //         console.log("LLM could not detect a valid name. Asking question again.");

            //         return {
            //             success: true,
            //             message: "Answer saved",
            //             data: {
            //                 flowInstanceId,
            //                 week,
            //                 isCompleted: false,
            //                 nextQuestion: this.mapNodeToQuestion(currentNode, flowInstanceId, week),
            //                 progress: await this.getProgress(flowInstanceId, flowDefinition),
            //             },
            //         };
            //     }

            //     // If name is valid, override the freeText with LLM's detected name
            //     freeText = detected_name;
            // }

            await this.chatFlowService.updateOnboardingData(
                userId,
                flowDefinition,
                currentNode.id,
                selectedKeys,
                freeText,
                selectedValues,
            );

            if (!saveResult.success) {
                return { success: false, message: saveResult.error || "Failed to save answer" };
            }

            // [FIX] Re-fetch user to get updated user_category
            const updatedUser = await UserModel.findById(userId);
            if (!updatedUser) {
                return { success: false, message: "User not found after update" };
            }

            // 7b. Grief-sensitive early exit: if the user reported a stillbirth on the
            // delivery-outcome question, stop the questionnaire and offer support instead
            // of asking the remaining questions.
            if (
                nodeId === "delivery_outcome" &&
                updatedUser.onboarding_data?.delivery_outcome === DeliveryOutcomeEnum.STILL_BIRTH
            ) {
                return await this.terminateOnStillBirth(
                    updatedUser,
                    flowInstance,
                    flowDefinition,
                    week,
                    lang,
                );
            }

            // 8. Move to next node
            const nextNodeId = await this.flowService.moveToNextNode(
                updatedUser,
                flowInstance,
                flowDefinition,
                nodeId,
                week,
            );

            // 9. Handle flow completion or next question
            if (!nextNodeId) {
                return await this.completeCheckin(
                    updatedUser,
                    flowInstance,
                    flowDefinition,
                    week,
                    lang,
                );
            }

            // 10. Get next question
            // Reload flow instance to get updated cursor
            const updatedInstance = await this.flowService.getFlowInstance(flowInstanceId);
            if (!updatedInstance) {
                return { success: false, message: "Failed to load updated flow instance" };
            }

            const questionResult = await this.getNextQuestion(
                updatedUser,
                updatedInstance,
                flowDefinition,
                week,
            );

            if (!questionResult.question) {
                // No more questions - complete the flow
                return await this.completeCheckin(
                    updatedUser,
                    updatedInstance,
                    flowDefinition,
                    week,
                    lang,
                );
            }

            // 11. Save AI message for the next question
            await this.saveQuestionMessage(updatedUser, updatedInstance, questionResult.question);

            logger.info(
                {
                    userId,
                    flowInstanceId,
                    previousNode: nodeId,
                    nextNode: questionResult.question.id,
                },
                "Answer processed, next question sent",
            );

            return {
                success: true,
                message: "Answer saved",
                data: {
                    flowInstanceId,
                    week,
                    isCompleted: false,
                    nextQuestion: questionResult.question,
                    progress: await this.getProgress(flowInstanceId, flowDefinition),
                },
            };
        } catch (error: any) {
            logger.error({ error, userId, flowInstanceId, nodeId }, "Error processing answer");
            return { success: false, message: "Failed to process answer" };
        }
    }

    /**
     * Map flow node to question payload
     */
    private mapNodeToQuestion(
        node: IFlowNode,
        flowInstanceId: string,
        week: number,
    ): QuestionPayload {
        return {
            id: node.id,
            flowInstanceId,
            week,
            text: node.text || "",
            educationalMessage: node.educationalMessage || "",
            whyThisMatters: node.whyThisMatters || "",
            options: node.options.map((opt) => ({
                id: opt.value,
                label: opt.label,
                value: opt.value,
                score: opt.score!,
            })),
            nodeType: node.nodeType,
        };
    }

    // ============================================
    // Question Building
    // ============================================

    /**
     * Get next valid question for the user
     */
    private async getNextQuestion(
        user: IUser,
        flowInstance: IFlowInstance,
        flowDefinition: IFlowDefinition,
        week: number,
    ): Promise<{ question: QuestionPayload | null }> {
        if (!flowInstance.cursorNodeId) {
            return { question: null };
        }

        // Find next valid node (may skip ineligible ones)
        const validNodeId = await this.flowService.findNextValidNode(
            user,
            flowInstance,
            flowDefinition,
            flowInstance.cursorNodeId,
            week,
        );

        if (!validNodeId) {
            return { question: null };
        }

        // Update cursor if we skipped nodes
        if (validNodeId !== flowInstance.cursorNodeId) {
            flowInstance.cursorNodeId = validNodeId;
            await (flowInstance as any).save();
        }

        const currentNode = this.flowService.getNode(flowDefinition, validNodeId);
        if (!currentNode) {
            logger.error({ nodeId: validNodeId }, "Node not found in definition");
            return { question: null };
        }

        // Build question payload
        const question: QuestionPayload = {
            id: currentNode.id,
            flowInstanceId: flowInstance._id.toString(),
            week,
            text: currentNode.text || "",
            educationalMessage: currentNode.educationalMessage || "",
            whyThisMatters: currentNode.whyThisMatters || "",
            options: currentNode.options.map((opt) => ({
                id: opt.value,
                label: opt.label,
                value: opt.value,
                score: opt.score!,
            })),
            nodeType: currentNode.nodeType,
        };

        return { question };
    }

    /**
     * Save AI message for a question
     */
    private async saveQuestionMessage(
        user: IUser,
        flowInstance: IFlowInstance,
        question: QuestionPayload,
    ): Promise<void> {
        await messageModel.create({
            conversationId: flowInstance.conversationId,
            userId: user._id,
            role: MessageRoleEnum.ASSITANT,
            type: MessageTypeEnum.GUIDED,
            text: question.text,
            guided: {
                flowInstanceId: flowInstance._id,
                nodeId: question.id,
                optionKey: null,
            },
        });
    }

    // ============================================
    // Flow Completion
    // ============================================

    /**
     * Complete the check-in flow
     */
    private async completeCheckin(
        user: IUser,
        flowInstance: IFlowInstance,
        flowDefinition: IFlowDefinition,
        week: number,
        lang: FlowLanguage,
    ): Promise<WeeklyCheckinResponse> {
        const userId = user._id.toString();

        // Onboarding and weekly check-in share this completion path; pick the
        // right localized "thank you" by flow slug.
        const completionKey =
            flowInstance.flowSlug === "weekly-checkin-v1" ? "CHECK_IN" : "ONBOARDING";
        const thankYouText = getFlowCompletionMessage(completionKey, lang);

        // 1. Update flow instance state
        flowInstance.cursorNodeId = null;
        flowInstance.state = FlowInstanceStateEnum.COMPLETED;
        await (flowInstance as any).save();

        // 2. Save thank you message
        await messageModel.create({
            conversationId: flowInstance.conversationId,
            userId: user._id,
            role: MessageRoleEnum.ASSITANT,
            type: MessageTypeEnum.GUIDED,
            text: thankYouText,
            guided: null,
        });
        if (flowInstance.flowSlug === "weekly-checkin-v1") {
            // Deliberately does NOT touch current_weekdays. The due-day counters are pure
            // functions of the delivery date now, so completing a check-in cannot change
            // them. This used to force upcoming_checkin_due_days to 7, which was simply
            // the wrong number — finishing on day 3 left the dashboard claiming the next
            // check-in was 7 days away when it was 4 — until the next nightly run
            // recomputed it. Whether a check-in is outstanding is carried by the
            // instance's own state, which the line above has just set to COMPLETED.

            // 3. Publish score job with retry
            await this.scorePublisherService.publishScoreJob(
                userId,
                flowInstance._id.toString(),
                user.FCM_token,
            );

            logger.info({ userId, week, flowInstanceId: flowInstance._id }, "Check-in completed");
        } else {
            await UserModel.findByIdAndUpdate(userId, {
                $set: {
                    "is_onboarded.is_questionnaire_completed": true,
                    "onboarding_data.onboarded_at": new Date(),
                },
            });
        }

        return {
            success: true,
            message: thankYouText,
            data: {
                flowInstanceId: flowInstance._id.toString(),
                week,
                isCompleted: true,
                nextQuestion: null,
                progress: await this.getProgress(flowInstance._id.toString(), flowDefinition),
                state: WeeklyCheckinStateEnum.COMPLETED,
            },
        };
    }

    /**
     * Terminate onboarding early after a reported stillbirth.
     *
     * Stops the questionnaire, marks onboarding complete, and auto-enrolls the
     * user in the free plan (skipping the subscription step) so the client can
     * route them straight to expert/AI support. Returns a tailored terminal
     * response flagged with terminationReason = "still_birth".
     */
    private async terminateOnStillBirth(
        user: IUser,
        flowInstance: IFlowInstance,
        flowDefinition: IFlowDefinition,
        week: number,
        lang: FlowLanguage,
    ): Promise<WeeklyCheckinResponse> {
        const userId = user._id.toString();
        const ackText = getStillBirthAckMessage(lang);

        // 1. Terminate the flow instance.
        flowInstance.cursorNodeId = null;
        flowInstance.state = FlowInstanceStateEnum.COMPLETED;
        await (flowInstance as any).save();

        // 2. Save the acknowledgement message.
        await messageModel.create({
            conversationId: flowInstance.conversationId,
            userId: user._id,
            role: MessageRoleEnum.ASSITANT,
            type: MessageTypeEnum.GUIDED,
            text: ackText,
            guided: null,
        });

        // 3. Complete onboarding + drop the user on the free tier (skip the subscription
        //    step). Mirrors PaymentService.selectFreePlan's snapshot shape. Dotted paths
        //    so `hasUsedTrial` survives.
        await UserModel.findByIdAndUpdate(userId, {
            $set: {
                "is_onboarded.is_questionnaire_completed": true,
                "is_onboarded.is_subscription_completed": true,
                "onboarding_data.onboarded_at": new Date(),
                "subscription.tier": ESubscriptionTier.FREE,
                "subscription.status": null,
                "subscription.planCode": null,
                "subscription.currentPeriodEnd": null,
            },
        });

        logger.info(
            { userId, week, flowInstanceId: flowInstance._id },
            "Onboarding terminated on stillbirth",
        );

        return {
            success: true,
            message: ackText,
            data: {
                flowInstanceId: flowInstance._id.toString(),
                week,
                isCompleted: true,
                nextQuestion: null,
                progress: await this.getProgress(flowInstance._id.toString(), flowDefinition),
                state: WeeklyCheckinStateEnum.COMPLETED,
                terminationReason: "still_birth",
            },
        };
    }

    // ============================================
    // Progress Tracking
    // ============================================

    /**
     * Get progress for a flow instance
     */
    private async getProgress(
        flowInstanceId: string,
        flowDefinition: IFlowDefinition,
    ): Promise<{ answered: number; total: number }> {
        const answeredCount = await flowResponseModel.countDocuments({ flowInstanceId });

        // Total is approximate - just count question nodes
        const questionNodes = flowDefinition.nodes.filter((node: IFlowNode) =>
            ["QUESTION_SINGLE", "QUESTION_MULTI", "QUESTION_FREE"].includes(node.nodeType),
        );

        return {
            answered: answeredCount,
            total: questionNodes.length,
        };
    }

    // ============================================
    // Status & State Queries
    // ============================================

    /**
     * Get check-in status for a week
     */
    async getCheckinStatus(userId: string, week: number): Promise<CheckinStatus> {
        const flowDefinition = await this.flowService.getFlowDefinition();

        if (!flowDefinition) {
            return {
                week,
                hasCheckin: false,
                state: null,
                isCompleted: false,
                isExpired: false,
                progress: null,
            };
        }

        const flowInstance = await flowInstanceModel.findOne({
            userId,
            flowDefId: flowDefinition._id,
            postpartumWeek: week,
        });

        if (!flowInstance) {
            return {
                week,
                hasCheckin: false,
                state: null,
                isCompleted: false,
                isExpired: false,
                progress: null,
            };
        }

        const isExpired = validationService.isExpired(flowInstance);
        const isCompleted = flowInstance.state === FlowInstanceStateEnum.COMPLETED;

        return {
            week,
            hasCheckin: true,
            state: flowInstance.state,
            isCompleted,
            isExpired,
            progress: await this.getProgress(flowInstance._id.toString(), flowDefinition),
        };
    }

    /**
     * Get current state for resuming a check-in
     */
    async getCurrentState(
        userId: string,
        week: number,
        lang?: string,
    ): Promise<CurrentStateResponse> {
        const user = await UserModel.findById(userId);
        if (!user) {
            return {
                hasActiveCheckin: false,
                flowInstanceId: null,
                week,
                state: null,
                currentQuestion: null,
                progress: null,
            };
        }

        const resolvedLang = resolveLanguage(lang, user.preferred_language);
        const flowDefinition = await this.flowService.getFlowDefinition(
            WEEKLY_CHECKIN_SLUG,
            resolvedLang,
        );
        if (!flowDefinition) {
            return {
                hasActiveCheckin: false,
                flowInstanceId: null,
                week,
                state: null,
                currentQuestion: null,
                progress: null,
            };
        }

        const flowInstance = await flowInstanceModel.findOne({
            userId,
            flowDefId: flowDefinition._id,
            postpartumWeek: week,
            state: { $in: [FlowInstanceStateEnum.ACTIVE, FlowInstanceStateEnum.PENDING] },
        });

        if (!flowInstance) {
            return {
                hasActiveCheckin: false,
                flowInstanceId: null,
                week,
                state: null,
                currentQuestion: null,
                progress: null,
            };
        }

        // Check expiration
        if (validationService.isExpired(flowInstance)) {
            await validationService.markAsExpired(flowInstance);
            return {
                hasActiveCheckin: false,
                flowInstanceId: flowInstance._id.toString(),
                week,
                state: WeeklyCheckinStateEnum.EXPIRED,
                currentQuestion: null,
                progress: null,
            };
        }

        // Get current question
        const questionResult = await this.getNextQuestion(user, flowInstance, flowDefinition, week);

        return {
            hasActiveCheckin: true,
            flowInstanceId: flowInstance._id.toString(),
            week,
            state: flowInstance.state,
            currentQuestion: questionResult.question,
            progress: await this.getProgress(flowInstance._id.toString(), flowDefinition),
        };
    }

    // ============================================
    // Public API for Cron Job
    // ============================================

    /**
     * Check if check-in exists for week
     */
    async hasCheckinForWeek(userId: string, week: number): Promise<boolean> {
        return this.flowService.hasCheckinForWeek(userId, week);
    }

    /**
     * Create pending check-in (called by cron job)
     */
    async createPendingCheckin(user: IUser, week: number): Promise<IFlowInstance | null> {
        try {
            // Check if already exists
            const exists = await this.hasCheckinForWeek(user._id.toString(), week);
            if (exists) {
                logger.info({ userId: user._id, week }, "Check-in already exists for week");
                return null;
            }

            // Get flow definition
            const flowDefinition = await this.flowService.getFlowDefinition();
            if (!flowDefinition) {
                logger.error("Weekly check-in flow definition not found");
                return null;
            }

            // Get or create conversation
            const conversationId = await this.getOrCreateConversation(user);

            // Create pending flow instance
            const flowInstance = await flowInstanceModel.create({
                userId: user._id,
                conversationId,
                flowDefId: flowDefinition._id,
                flowSlug: WEEKLY_CHECKIN_SLUG,
                version: flowDefinition.version,
                postpartumWeek: week,
                state: WeeklyCheckinStateEnum.PENDING,
                cursorNodeId: flowDefinition.startNodeId,
                variables: {},
                outcome: null,
            });

            // Send notification
            await this.notificationService.sendNewCheckinNotification(
                user,
                week,
                flowInstance._id.toString(),
            );

            logger.info(
                { userId: user._id, week, flowInstanceId: flowInstance._id },
                "Created pending check-in",
            );

            return flowInstance;
        } catch (error) {
            logger.error({ error, userId: user._id, week }, "Failed to create pending check-in");
            return null;
        }
    }

    /**
     * Get or create the check-in conversation.
     *
     * Delegates so the tag and title match every other creation path — this copy used to
     * title it "Check-in" while the on-demand path used "Weekly Check-in", so which name
     * a user ended up with depended on which code created her row first.
     */
    private async getOrCreateConversation(user: IUser): Promise<Schema.Types.ObjectId> {
        const conversation = await getOrCreateFlowConversation(user, WEEKLY_CHECKIN_SLUG);
        return conversation._id as Schema.Types.ObjectId;
    }

    // ============================================
    // Stats & Monitoring
    // ============================================

    /**
     * Get service stats
     */
    getStats(): {
        deadLetterQueue: number;
    } {
        return {
            deadLetterQueue: this.scorePublisherService.getDeadLetterCount(),
        };
    }
}

export default WeeklyCheckinService;
