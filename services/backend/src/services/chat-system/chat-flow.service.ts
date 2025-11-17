import { Response } from "express";
import flowDefinitionModel from "../../models/flowDefinition.model";
import flowInstanceModel from "../../models/flowInstance.model";
import flowResponseModel from "../../models/flowResponse.model";
import messageModel from "../../models/message.model";
import conversationModel from "../../models/conversation.model";
import userModel from "../../models/user.model";
import admin from "../../config/firebase";
import {
    FlowInstanceStateEnum,
    AnswerTypeEnum,
    MessageRoleEnum,
    MessageTypeEnum,
    IFlowNode,
} from "../../types/chat.types";
import { Schema } from "mongoose";

interface QuestionPayload {
    id: string;
    flowInstanceId: string;
    text: string;
    educationalMessage: string;
    whyThisMatters: string;
    options: Array<{
        id: string;
        label: string;
        value: any;
    }>;
}

interface EndFlowPayload {
    type: "end_flow";
}

// Simulation delay
const QUESTION_FETCH_DELAY_MS = 4000;

class ChatFlowService {
    // Store active SSE connections: userId -> Response object
    private activeSessions = new Map<string, Response>();

    // Track pending questions being fetched: userId -> { questionId, timeoutId }
    private pendingQuestions = new Map<string, { questionId: string; timeoutId: NodeJS.Timeout }>();

    public async handleSseConnection(userId: string, slug: string, res: Response): Promise<void> {
        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");
        res.flushHeaders();

        console.log(`🔌 User ${userId} connected via SSE for flow: ${slug}`);

        // Store the connection
        this.activeSessions.set(userId, res);

        try {
            // 1. Get flow definition
            const flowDefinition = await flowDefinitionModel.findOne({
                slug: slug,
                status: "PUBLISHED",
            });

            if (!flowDefinition) {
                this.sendError(res, "Flow not found");
                return;
            }

            // 2. Find or create FlowInstance
            let flowInstance = await flowInstanceModel.findOne({
                userId: userId,
                flowDefId: flowDefinition._id,
                state: FlowInstanceStateEnum.ACTIVE,
            });

            // Check if there's a pending question being fetched
            const pending = this.pendingQuestions.get(userId);
            if (pending) {
                console.log(
                    `⏳ User ${userId} reconnected. Pending question ${pending.questionId} will complete shortly.`,
                );
                // The delay will complete and send via SSE since user is now online
                return;
            }

            if (!flowInstance) {
                // Create new flow instance - with delay
                console.log(
                    `🆕 New user ${userId}. Fetching first question with ${QUESTION_FETCH_DELAY_MS}ms delay...`,
                );

                const conversationId = await this.getOrCreateConversation(userId);
                const startNodeId = flowDefinition.startNodeId;

                flowInstance = await new flowInstanceModel({
                    userId: userId,
                    conversationId: conversationId,
                    flowDefId: flowDefinition._id,
                    flowSlug: slug,
                    version: flowDefinition.version,
                    postpartumWeek: 1,
                    state: FlowInstanceStateEnum.ACTIVE,
                    cursorNodeId: startNodeId,
                    variables: {},
                    outcome: null,
                }).save();

                // Mark as pending
                const timeoutId = setTimeout(async () => {
                    this.pendingQuestions.delete(userId);
                    await this.sendCurrentQuestion(userId, flowInstance, flowDefinition, res);
                }, QUESTION_FETCH_DELAY_MS);

                this.pendingQuestions.set(userId, { questionId: startNodeId, timeoutId });
            } else {
                // Returning user - send current question immediately
                console.log(
                    `🔄 Returning user ${userId}. Current cursor: ${flowInstance.cursorNodeId}`,
                );
                await this.sendCurrentQuestion(userId, flowInstance, flowDefinition, res);
            }
        } catch (error) {
            console.error("❌ Error in SSE connection:", error);
            this.sendError(res, "Internal server error");
        }

        // Handle disconnect
        res.on("close", () => {
            console.log(`🔌❌ User ${userId} disconnected`);
            this.activeSessions.delete(userId);

            // Check if there's a pending question
            const pending = this.pendingQuestions.get(userId);
            if (pending) {
                console.log(
                    `📴 User ${userId} went offline while fetching question. Will send via push when ready.`,
                );
                // The timeout will still complete and send via FCM instead of SSE
            }
        });
    }

    public async saveAnswer(
        userId: string,
        flowInstanceId: string,
        nodeId: string,
        selectedKeys: string[],
    ): Promise<{ success: boolean; message: string }> {
        try {
            console.log(
                `📝 Saving answer - User: ${userId}, Node: ${nodeId}, Answer: ${selectedKeys}`,
            );

            // 1. Get FlowInstance
            const flowInstance = await flowInstanceModel.findOne({
                _id: flowInstanceId,
                userId: userId,
                state: FlowInstanceStateEnum.ACTIVE,
            });

            if (!flowInstance) {
                throw new Error("FlowInstance not found or already completed");
            }

            // 2. Verify this is the current question
            if (flowInstance.cursorNodeId !== nodeId) {
                throw new Error(
                    `Wrong question. Expected: ${flowInstance.cursorNodeId}, Got: ${nodeId}`,
                );
            }

            // 3. Get FlowDefinition
            const flowDefinition = await flowDefinitionModel.findById(flowInstance.flowDefId);
            if (!flowDefinition) {
                throw new Error("FlowDefinition not found");
            }

            // 4. Get current node
            const currentNode = flowDefinition.nodes.find((n) => n.id === nodeId);
            if (!currentNode) {
                throw new Error("Node not found");
            }

            // 5. Determine answer type
            let answerType: AnswerTypeEnum;
            if (currentNode.nodeType === "QUESTION_SINGLE") {
                answerType = AnswerTypeEnum.SINGLE;
            } else if (currentNode.nodeType === "QUESTION_MULTI") {
                answerType = AnswerTypeEnum.MULTI;
            } else {
                answerType = AnswerTypeEnum.FREE;
            }

            // 6. Save answer to FlowResponse
            await new flowResponseModel({
                flowInstanceId: flowInstance._id,
                nodeId: nodeId,
                answer: {
                    type: answerType,
                    selectedKeys: selectedKeys,
                    freeText: null,
                },
                computed: null,
            }).save();

            console.log(`✅ Answer saved to FlowResponse`);

            // 7. Save user message to conversation
            const selectedOptions = currentNode.options.filter((opt) =>
                selectedKeys.includes(opt.value),
            );
            const userAnswerText = selectedOptions.map((o) => o.label).join(", ");

            await new messageModel({
                conversationId: flowInstance.conversationId,
                userId: userId,
                role: MessageRoleEnum.USER,
                type: MessageTypeEnum.GUIDED,
                text: userAnswerText,
                rich: null,
                attachments: null,
                ai: null,
                guided: {
                    flowInstanceId: flowInstance._id,
                    nodeId: nodeId,
                    optionKey: selectedKeys.join(","),
                },
            }).save();

            console.log(`✅ User message saved to conversation`);

            // 8. Calculate next node
            const nextNodeId = currentNode.next;

            if (!nextNodeId) {
                // No more questions - flow complete
                flowInstance.cursorNodeId = null;
                flowInstance.state = FlowInstanceStateEnum.COMPLETED;
                await flowInstance.save();
                console.log(`🏁 Flow completed`);

                const userConnection = this.activeSessions.get(userId);
                if (userConnection) {
                    this.endFlow(userId, userConnection);
                }

                return { success: true, message: "Flow completed" };
            }

            // 9. Update cursorNodeId
            flowInstance.cursorNodeId = nextNodeId;
            await flowInstance.save();
            console.log(`➡️  Moving cursor to: ${nextNodeId}`);

            // 10. Simulate delay for fetching next question
            console.log(
                `⏳ Fetching next question ${nextNodeId} with ${QUESTION_FETCH_DELAY_MS}ms delay...`,
            );

            // Mark as pending
            const timeoutId = setTimeout(async () => {
                this.pendingQuestions.delete(userId);

                const userConnection = this.activeSessions.get(userId);
                if (userConnection) {
                    // User is online - send via SSE
                    await this.sendCurrentQuestion(
                        userId,
                        flowInstance,
                        flowDefinition,
                        userConnection,
                    );
                } else {
                    // User is offline - send via silent push
                    console.log(`📴 User ${userId} offline. Sending silent push...`);
                    await this.sendSilentPush(userId, flowInstance, flowDefinition);
                }
            }, QUESTION_FETCH_DELAY_MS);

            this.pendingQuestions.set(userId, { questionId: nextNodeId, timeoutId });

            return { success: true, message: "Answer saved, fetching next question" };
        } catch (error: any) {
            console.error("❌ Error saving answer:", error);
            throw error;
        }
    }

    private async sendCurrentQuestion(
        userId: string,
        flowInstance: any,
        flowDefinition: any,
        res: Response,
    ): Promise<void> {
        if (!flowInstance.cursorNodeId) {
            this.endFlow(userId, res);
            return;
        }

        const currentNode = flowDefinition.nodes.find(
            (n: IFlowNode) => n.id === flowInstance.cursorNodeId,
        );

        if (!currentNode) {
            console.error(`❌ Node ${flowInstance.cursorNodeId} not found`);
            this.endFlow(userId, res);
            return;
        }

        const formattedOptions = currentNode.options.map((opt: any) => ({
            id: opt.value,
            label: opt.label,
            value: opt.value,
        }));

        const payload: QuestionPayload = {
            id: currentNode.id,
            flowInstanceId: flowInstance._id.toString(),
            text: currentNode.text || "",
            educationalMessage: currentNode.educationalMessage || "",
            whyThisMatters: currentNode.whyThisMatters || "",
            options: formattedOptions,
        };

        // Save AI message to conversation
        await new messageModel({
            conversationId: flowInstance.conversationId,
            userId: userId,
            role: MessageRoleEnum.ASSITANT,
            type: MessageTypeEnum.GUIDED,
            text: payload.text,
            rich: null,
            attachments: null,
            ai: null,
            guided: {
                flowInstanceId: flowInstance._id,
                nodeId: currentNode.id,
                optionKey: null,
            },
        }).save();

        // Send via SSE
        res.write(`data: ${JSON.stringify(payload)}\n\n`);
        console.log(`📡 Sent question via SSE: ${currentNode.id}`);
    }

    private async sendSilentPush(
        userId: string,
        flowInstance: any,
        flowDefinition: any,
    ): Promise<void> {
        try {
            // Get user's FCM token
            const user = await userModel.findById(userId);
            if (!user || !user.FCM_token) {
                console.log(`⚠️  No FCM token for user ${userId}`);
                return;
            }

            const currentNode = flowDefinition.nodes.find(
                (n: IFlowNode) => n.id === flowInstance.cursorNodeId,
            );

            if (!currentNode) {
                console.error(`❌ Node not found for silent push`);
                return;
            }

            const formattedOptions = currentNode.options.map((opt: any) => ({
                id: opt.value,
                label: opt.label,
                value: opt.value,
            }));

            const questionPayload: QuestionPayload = {
                id: currentNode.id,
                flowInstanceId: flowInstance._id.toString(),
                text: currentNode.text || "",
                educationalMessage: currentNode.educationalMessage || "",
                whyThisMatters: currentNode.whyThisMatters || "",
                options: formattedOptions,
            };

            // Send silent push
            const message = {
                data: {
                    type: "NEW_QUESTION",
                    questionData: JSON.stringify(questionPayload),
                },
                token: user.FCM_token,
                apns: {
                    headers: {
                        "apns-push-type": "background",
                        "apns-priority": "5",
                    },
                    payload: {
                        aps: {
                            "content-available": 1,
                        },
                    },
                },
                android: {
                    priority: "high" as const,
                },
            };

            await admin.messaging().send(message);
            console.log(`📲 Sent silent push for question ${currentNode.id} to user ${userId}`);

            // Save AI message to conversation
            await new messageModel({
                conversationId: flowInstance.conversationId,
                userId: userId,
                role: MessageRoleEnum.ASSITANT,
                type: MessageTypeEnum.GUIDED,
                text: questionPayload.text,
                rich: null,
                attachments: null,
                ai: null,
                guided: {
                    flowInstanceId: flowInstance._id,
                    nodeId: currentNode.id,
                    optionKey: null,
                },
            }).save();
        } catch (error) {
            console.error("❌ Error sending silent push:", error);
        }
    }

    private endFlow(userId: string, res: Response): void {
        console.log(`🏁 Ending flow for user ${userId}`);

        const payload: EndFlowPayload = {
            type: "end_flow",
        };

        res.write(`data: ${JSON.stringify(payload)}\n\n`);
        res.end();

        this.activeSessions.delete(userId);
    }

    private async getOrCreateConversation(userId: string): Promise<Schema.Types.ObjectId> {
        let conversation = await conversationModel.findOne({
            userId: userId,
            chatMode: "GUIDED_ONLY",
        });

        if (!conversation) {
            conversation = await new conversationModel({
                userId: userId,
                title: "Onboarding",
                chatMode: "GUIDED_ONLY",
                lastMessageAt: new Date(),
                meta: {
                    channel: "App",
                    tags: ["onboarding"],
                },
            }).save();
        }

        return conversation._id;
    }

    private sendError(res: Response, message: string): void {
        res.write(`data: ${JSON.stringify({ type: "error", message })}\n\n`);
        res.end();
    }
}

export default ChatFlowService;
