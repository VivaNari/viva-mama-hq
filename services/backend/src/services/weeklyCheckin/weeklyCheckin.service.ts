import { Response } from "express";
import { Schema } from "mongoose";

import flowInstanceModel from "../../models/flowInstance.model";
import messageModel from "../../models/message.model";
import conversationModel from "../../models/conversation.model";

import {
    IFlowDefinition,
    IFlowInstance,
    FlowInstanceStateEnum,
    FlowTypeEnum,
    FlowNodeEnum,
    MessageRoleEnum,
    MessageTypeEnum,
    WeeklyCheckinSSEParams,
    WeeklyCheckinAnswerParams,
    WeeklyCheckinResponse,
    WeeklyCheckinState,
    IWeeklyCheckinQuestion,
} from "../../types/chat.types";
import { IUser } from "../../types/user.types";
import {
    WEEKLY_CHECKIN_SLUG,
    WEEKLY_CHECKIN_MESSAGES,
    CHECKIN_SSE_EVENTS,
} from "../../constants/chat";

// Import SRP services
import { sessionManager } from "../../utils/sessionManager";
import { validationService } from "./validation.service";
import FlowService from "./flow.service";
import AnswerService from "./answer.service";
import ScorePublisherService from "./scorePublisher.service";
import NotificationService from "./notification.service";

import UserModel from "../../models/user.model";
import { getUuid } from "../../utils/commonFunctions/uuid";
import logger from "../../utils/logger";

/**
 * WeeklyCheckinService - Orchestrator
 *
 * Single Responsibility: Coordinate all check-in operations
 *
 * Delegates to:
 * - SessionManager: SSE connections & pending questions
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

    constructor() {
        this.answerService = new AnswerService();
        this.flowService = new FlowService();
        this.notificationService = new NotificationService();
        this.scorePublisherService = new ScorePublisherService();
    }
    // ============================================
    // SSE Connection Handler
    // ============================================

    /**
     * Handle SSE connection for weekly check-in
     */
    async handleSSEConnection(params: WeeklyCheckinSSEParams, res: Response): Promise<void> {
        const { userId, week, flowSlug } = params;

        try {
            // 1. Initialize SSE headers
            sessionManager.initSSEHeaders(res);

            // 2. Get user
            const user = await UserModel.findById(userId);
            if (!user) {
                sessionManager.sendErrorAndClose(res, "User not found", "USER_NOT_FOUND");
                return;
            }

            logger.info({ userId, week, flowSlug }, "Weekly check-in SSE connection initiated");

            // 3. Validate and get flow instance
            const validation = await validationService.validateSSERequest(user, week, flowSlug);

            if (!validation.isValid || !validation.flowInstance) {
                sessionManager.sendErrorAndClose(
                    res,
                    validation.error?.message || "Validation failed",
                    validation.error?.type,
                );
                return;
            }

            const flowInstance = validation.flowInstance;

            // 4. Get flow definition
            const flowDefinition = await this.flowService.getFlowDefinitionById(
                flowInstance.flowDefId.toString(),
            );

            if (!flowDefinition) {
                sessionManager.sendErrorAndClose(
                    res,
                    WEEKLY_CHECKIN_MESSAGES.FLOW_NOT_FOUND,
                    "FLOW_NOT_FOUND",
                );
                return;
            }

            // 5. Register session
            sessionManager.setSession(userId, res, week);

            // 6. Check for pending question (reconnection scenario)
            if (sessionManager.hasPendingQuestionForWeek(userId, week)) {
                logger.info({ userId, week }, "User reconnected with pending question");
                // Don't resend question - wait for answer
                this.setupDisconnectHandler(user, res, flowInstance, flowDefinition, week);
                return;
            }

            // 7. Send current question
            await this.sendCurrentQuestion(user, res, flowInstance, flowDefinition, week);

            // 8. Setup disconnect handler
            this.setupDisconnectHandler(user, res, flowInstance, flowDefinition, week);
        } catch (error) {
            logger.error({ error, userId, week }, "Weekly check-in SSE connection error");
            sessionManager.sendErrorAndClose(res, "Internal server error", "CONNECTION_ERROR");
        }
    }

    // ============================================
    // Answer Processing
    // ============================================

    /**
     * Process user's answer
     */
    async processAnswer(params: WeeklyCheckinAnswerParams): Promise<WeeklyCheckinResponse> {
        const { userId, flowInstanceId, nodeId, week, selectedKeys, freeText } = params;
        const idempotencyKey = (params as any).idempotencyKey;

        try {
            // 1. Validate inputs
            if (!selectedKeys?.length && !freeText) {
                return {
                    success: false,
                    message: "Either selectedKeys or freeText must be provided",
                };
            }

            // 2. Get user
            const user = await UserModel.findById(userId);
            if (!user) {
                return { success: false, message: "User not found" };
            }

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
                };
            }

            // 4. Handle duplicate (idempotent response)
            if (validation.isDuplicate) {
                logger.info(
                    { userId, nodeId, idempotencyKey },
                    "Duplicate request - returning success",
                );
                return {
                    success: true,
                    message: "Already processed",
                    data: {
                        flowInstanceId,
                        week,
                    },
                };
            }

            const flowInstance = validation.flowInstance!;

            // 5. Get flow definition and current node
            const flowDefinition = await this.flowService.getFlowDefinitionById(
                flowInstance.flowDefId.toString(),
            );

            if (!flowDefinition) {
                return { success: false, message: "Flow definition not found" };
            }

            const currentNode = this.flowService.getNode(flowDefinition, nodeId);
            if (!currentNode) {
                return { success: false, message: "Node not found" };
            }

            // 6. Save answer
            const saveResult = await this.answerService.saveAnswer(
                user,
                flowInstance,
                currentNode,
                {
                    selectedKeys,
                    freeText,
                    idempotencyKey,
                },
            );

            if (!saveResult.success) {
                return { success: false, message: saveResult.error || "Failed to save answer" };
            }

            // 7. Clear pending question
            sessionManager.clearPendingQuestion(userId);

            // 8. Find next node
            const nextNodeId = await this.flowService.moveToNextNode(
                user,
                flowInstance,
                flowDefinition,
                nodeId,
                week,
            );

            // 9. Handle flow completion or next question
            if (!nextNodeId) {
                return await this.completeCheckin(user, flowInstance, flowDefinition, week);
            }

            // 10. Send next question via SSE
            const userSession = sessionManager.getSession(userId);
            if (userSession) {
                // Reload flow instance to get updated cursor
                const updatedInstance = await this.flowService.getFlowInstance(flowInstanceId);
                if (updatedInstance) {
                    await this.sendCurrentQuestion(
                        user,
                        userSession,
                        updatedInstance,
                        flowDefinition,
                        week,
                    );
                }
            }

            return {
                success: true,
                message: "Answer saved, fetching next question",
                data: {
                    flowInstanceId,
                    week,
                    nextNodeId,
                },
            };
        } catch (error: any) {
            logger.error({ error, userId, flowInstanceId, nodeId }, "Error processing answer");
            return { success: false, message: "Failed to process answer" };
        }
    }

    // ============================================
    // Question Sending
    // ============================================

    /**
     * Send current question via SSE
     */
    private async sendCurrentQuestion(
        user: IUser,
        res: Response,
        flowInstance: IFlowInstance,
        flowDefinition: IFlowDefinition,
        week: number,
    ): Promise<void> {
        const userId = user._id.toString();

        if (!flowInstance.cursorNodeId) {
            await this.endFlow(userId, res, week);
            return;
        }

        // Find next valid node (may skip some)
        const validNodeId = await this.flowService.findNextValidNode(
            user,
            flowInstance,
            flowDefinition,
            flowInstance.cursorNodeId,
            week,
        );

        if (!validNodeId) {
            await this.endFlow(userId, res, week);
            return;
        }

        // Update cursor if we skipped nodes
        if (validNodeId !== flowInstance.cursorNodeId) {
            flowInstance.cursorNodeId = validNodeId;
            await (flowInstance as any).save();
        }

        const currentNode = this.flowService.getNode(flowDefinition, validNodeId);
        if (!currentNode) {
            logger.error({ nodeId: validNodeId }, "Node not found");
            await this.endFlow(userId, res, week);
            return;
        }

        // Build question payload
        const payload: IWeeklyCheckinQuestion = {
            type: CHECKIN_SSE_EVENTS.QUESTION,
            uuid: getUuid(),
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
            askId: Date.now(),
        };

        // Save AI message
        await messageModel.create({
            conversationId: flowInstance.conversationId,
            userId: user._id,
            role: MessageRoleEnum.ASSITANT,
            type: MessageTypeEnum.GUIDED,
            text: payload.text,
            guided: {
                flowInstanceId: flowInstance._id,
                nodeId: currentNode.id,
                optionKey: null,
            },
        });

        // Send via SSE
        sessionManager.writeToSession(userId, payload as unknown as Record<string, unknown>);

        // Set pending question with TTL
        sessionManager.setPendingQuestion(userId, currentNode.id, week);

        logger.info({ userId, nodeId: currentNode.id, week }, "Sent check-in question");
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
    ): Promise<WeeklyCheckinResponse> {
        const userId = user._id.toString();

        // 1. Update flow instance state
        flowInstance.cursorNodeId = null;
        flowInstance.state = FlowInstanceStateEnum.COMPLETED;
        await (flowInstance as any).save();

        // 2. Send thank you message
        const userSession = sessionManager.getSession(userId);
        if (userSession) {
            await this.sendThankYouMessage(user, flowInstance, userSession, week);
        }

        // 3. Publish score job with retry
        await this.scorePublisherService.publishScoreJob(
            userId,
            flowInstance._id.toString(),
            user.FCM_token,
        );

        logger.info({ userId, week, flowInstanceId: flowInstance._id }, "Check-in completed");

        return {
            success: true,
            message: "Check-in completed. Score processing initiated.",
            data: {
                flowInstanceId: flowInstance._id.toString(),
                week,
                state: WeeklyCheckinState.COMPLETED,
            },
        };
    }

    /**
     * Send thank you message and end flow
     */
    private async sendThankYouMessage(
        user: IUser,
        flowInstance: IFlowInstance,
        res: Response,
        week: number,
    ): Promise<void> {
        const userId = user._id.toString();

        const thankYouPayload = {
            type: CHECKIN_SSE_EVENTS.END_FLOW,
            text: WEEKLY_CHECKIN_MESSAGES.THANK_YOU,
            flowType: FlowTypeEnum.CHECK_IN,
            week,
        };

        // Save message
        await messageModel.create({
            conversationId: flowInstance.conversationId,
            userId: user._id,
            role: MessageRoleEnum.ASSITANT,
            type: MessageTypeEnum.GUIDED,
            text: thankYouPayload.text,
            guided: null,
        });

        // Send and close
        sessionManager.writeToSession(userId, thankYouPayload);
        sessionManager.closeSession(userId);
    }

    /**
     * End flow without thank you (edge case)
     */
    private async endFlow(userId: string, res: Response, week: number): Promise<void> {
        const endPayload = {
            type: CHECKIN_SSE_EVENTS.END_FLOW,
            text: "Flow completed",
            nodeType: FlowNodeEnum.END,
            flowType: FlowTypeEnum.CHECK_IN,
            week,
        };

        sessionManager.writeToSession(userId, endPayload);
        sessionManager.closeSession(userId);
    }

    // ============================================
    // Disconnect Handling
    // ============================================

    /**
     * Setup disconnect handler
     */
    private setupDisconnectHandler(
        user: IUser,
        res: Response,
        flowInstance: IFlowInstance,
        flowDefinition: IFlowDefinition,
        week: number,
    ): void {
        const userId = user._id.toString();

        res.on("close", async () => {
            logger.info({ userId, week }, "User disconnected from check-in SSE");

            // Session is already cleaned up by sessionManager when response ends
            // But we need to check for pending question and send silent push

            const pendingQuestion = sessionManager.getPendingQuestion(userId);
            if (!pendingQuestion || pendingQuestion.week !== week) {
                sessionManager.clearPendingQuestion(userId);
                return;
            }

            // Get current node for silent push
            const currentNode = this.flowService.getNode(
                flowDefinition,
                pendingQuestion.questionId,
            );
            if (currentNode) {
                await this.notificationService.sendSilentPush(
                    user,
                    flowInstance,
                    currentNode,
                    week,
                );
            }
        });
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
                state: WeeklyCheckinState.PENDING,
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
     * Get or create check-in conversation
     */
    private async getOrCreateConversation(user: IUser): Promise<Schema.Types.ObjectId> {
        let conversation = await conversationModel.findOne({
            userId: user._id,
            chatMode: "GUIDED_ONLY",
            "meta.tags": "check-in",
        });

        if (!conversation) {
            conversation = await conversationModel.create({
                userId: user._id,
                title: "Check-in",
                chatMode: "GUIDED_ONLY",
                lastMessageAt: new Date(),
                meta: {
                    channel: "App",
                    tags: ["check-in"],
                },
            });
        }

        return conversation._id;
    }

    // ============================================
    // Stats & Monitoring
    // ============================================

    /**
     * Get service stats
     */
    getStats(): {
        sessions: { activeSessions: number; pendingQuestions: number };
        deadLetterQueue: number;
    } {
        return {
            sessions: sessionManager.getStats(),
            deadLetterQueue: this.scorePublisherService.getDeadLetterCount(),
        };
    }

    /**
     * Graceful shutdown
     */
    async shutdown(): Promise<void> {
        await sessionManager.shutdown();
    }
}

// Default export for backward compatibility
export default WeeklyCheckinService;
