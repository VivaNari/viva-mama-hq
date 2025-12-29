import { Response } from "express";
import { Schema, Types } from "mongoose";
import admin from "../../config/firebase";
import conversationModel from "../../models/conversation.model";
import flowDefinitionModel from "../../models/flowDefinition.model";
import flowInstanceModel from "../../models/flowInstance.model";
import flowResponseModel from "../../models/flowResponse.model";
import messageModel from "../../models/message.model";
import {
    AIGreetingMessage,
    AILLMResponse,
    AnswerData,
    AnswerTypeEnum,
    EndFlowPayload,
    FlowInstanceStateEnum,
    FlowNodeEnum,
    FlowType,
    FlowTypeEnum,
    IFlowDefinition,
    IFlowInstance,
    IFlowNode,
    IMessage,
    MessageRoleEnum,
    MessageTypeEnum,
    QuestionPayload,
    QuestionSourceEnum,
} from "../../types/chat.types";
import { transformFlowResponsesToIndicators } from "../../utils/transform-indicators.util";
import redisPublisherService from "../redis/redis-publisher.service";
// import { v4 as uuidv4 } from "uuid";
import { ONBOARDING_SLUG } from "../../constants/conversationSlugs";
import UserModel from "../../models/user.model";
import {
    AlcoholUseEnum,
    ConceptionMethod,
    CurrentMedicationEnum,
    DeliveryOutcomeEnum,
    DeliveryTypeEnum,
    EUserCategory,
    IUser,
    ParityEnum,
    PastMedicationEnum,
    PregnancyConditionEnum,
    SocialSupportEnum,
    TobaccoUseEnum,
} from "../../types";
import { calculateUserCurrentWeek } from "../../utils/functions/calculateUserCurrentWeek";
import { FlowInstanceService } from "../flow/flow-instance.service";
import { getAIGreetingMessage } from "../../utils/commonFunctions/chatbot";
import BaseService from "../base.service";
import UserService from "../users/user.service";
import MessageService from "../message/message.service";
import LLMService from "../llm/llm.service";
import FlowResponseService from "./flowResponse.service";
import axios from "axios";
import { getUuid } from "../../utils/commonFunctions/uuid";
import { NAME_QUERY } from "../../constants/chat";

const STOPPED_BREASTFEEDING_SCORE = -1;

class ChatFlowService extends BaseService<IFlowDefinition> {
    private activeSessions = new Map<string, Response>();
    private pendingQuestions = new Map<string, { questionId: string }>();
    private flowInstanceService: FlowInstanceService;
    private userService: UserService;
    private messageService: MessageService;
    private llmService: LLMService;
    private flowResponseService: FlowResponseService;

    constructor() {
        super(flowDefinitionModel);
        this.flowInstanceService = new FlowInstanceService();
        this.userService = new UserService();
        this.messageService = new MessageService();
        this.llmService = new LLMService();
        this.flowResponseService = new FlowResponseService();
    }

    setSseConnection = (res: Response): void => {
        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");
        res.flushHeaders();
    };

    writeToSse = (res: Response, payload: Record<string, unknown>): void => {
        res.write(`data: ${JSON.stringify(payload)}\n\n`);
    };

    sendInitialGreeting = async (userInstance: IUser, res: Response): Promise<void> => {
        try {
            const {
                onboarding_data: { preferred_name },
            } = userInstance as IUser;

            const greeetingMessage: AIGreetingMessage = {
                type: "chatbot_message",
                text: getAIGreetingMessage(preferred_name || "there"),
                timestamp: Date.now(),
                response: {},
                nodeType: FlowNodeEnum.QUESTION_FREE_TEXT,
            };
            this.writeToSse(res, greeetingMessage);
        } catch (error) {
            throw error;
        }
    };

    processAIFlowConnection = async (userInstance: IUser, res: Response): Promise<boolean> => {
        await this.getOrCreateChatbotConversation(userInstance);
        await this.sendInitialGreeting(userInstance, res);
        return true;
    };

    getPendingQuestion = (userInstance: IUser): { questionId: string } | undefined => {
        return this.pendingQuestions.get(userInstance._id as unknown as string);
    };

    deletePendingQuestion = (userInstance: IUser): void => {
        this.pendingQuestions.delete(userInstance._id as unknown as string);
    };

    sendGuidedFlowResponse = async (
        userInstance: IUser,
        res: Response,
        flowDefinition: IFlowDefinition,
        flowType: string,
        slug: string,
    ) => {
        let flowInstance = await this.flowInstanceService.findOne({
            filter: {
                userId: userInstance._id,
                flowDefId: flowDefinition._id,
                state: FlowInstanceStateEnum.ACTIVE,
            },
        });
        if (!flowInstance) {
            const conversationId = await this.getOrCreateConversation(
                userInstance,
                flowType as FlowType,
            );
            const startNodeId: string = flowDefinition.startNodeId;
            const currentWeek: number = userInstance.current_weekdays.weeks as number;

            flowInstance = await this.flowInstanceService.create({
                userId: userInstance._id,
                conversationId: conversationId,
                flowDefId: flowDefinition._id,
                flowSlug: slug,
                version: flowDefinition.version,
                postpartumWeek: currentWeek,
                state: FlowInstanceStateEnum.ACTIVE,
                cursorNodeId: startNodeId,
                variables: {},
                outcome: null,
            });
            this.deletePendingQuestion(userInstance);
        }
        this.sendCurrentQuestion(
            userInstance,
            res,
            flowInstance,
            flowDefinition,
            flowType as FlowType,
        );
    };

    processGuidedFlowConnection = async (
        userInstance: IUser,
        res: Response,
        slug: string,
        flowType: FlowType,
    ): Promise<boolean> => {
        const flowDefinition = await this.findOne({
            filter: { slug: slug, status: "PUBLISHED" },
        });
        if (!flowDefinition) {
            throw new Error("Flow not found");
        }

        const pendingQuestion = this.getPendingQuestion(userInstance);
        if (pendingQuestion) {
            console.log(
                `User ${userInstance._id} reconnected with pending question: ${pendingQuestion.questionId}. ` +
                    `Question already sent - waiting for user to submit answer. No new question will be sent.`,
            );
            return false;
        }
        this.sendGuidedFlowResponse(userInstance, res, flowDefinition, flowType, slug);
        return true;
    };

    initInstanceVariables = async ({ res }: { res: Response }): Promise<void> => {
        this.setSseConnection(res);
    };

    sendSilentPushNotification = async (
        userInstance: IUser,
        slug: string,
        flowType: FlowType,
    ): Promise<void> => {
        try {
            const flowInstance = await this.flowInstanceService.findOne({
                filter: {
                    userId: userInstance._id as unknown as string,
                    state: FlowInstanceStateEnum.ACTIVE,
                    flowSlug: slug,
                },
            });
            if (!flowInstance) {
                throw new Error("No active flow instance found for silent push");
            }

            const flowDefinition = await this.findById({ filter: { _id: flowInstance.flowDefId } });
            if (!flowDefinition) {
                throw new Error("Flow definition not found for silent push");
            }

            await this.sendSilentPush(
                userInstance._id as unknown as string,
                flowInstance,
                flowDefinition,
                flowType,
            );
        } catch (error) {
            console.error(`Error handling disconnect for ${userInstance._id}:`, error);
        }
    };

    handleOnCloseSseConnection = (
        userInstance: IUser,
        res: Response,
        flowType: FlowType,
        slug: string,
    ): void => {
        res.on("close", async () => {
            console.log(`User ${userInstance._id} disconnected`);
            this.activeSessions.delete(userInstance._id as unknown as string);
            if (flowType === FlowTypeEnum.CHATBOT) {
                return;
            }

            const pendingQuestion = this.getPendingQuestion(userInstance);
            if (!pendingQuestion) {
                return;
            }

            this.deletePendingQuestion(userInstance);

            await this.sendSilentPushNotification(userInstance, slug, flowType);
        });
    };

    handleSseConnection = async (
        userId: string,
        slug: string,
        flowType: FlowType,
        res: Response,
    ): Promise<void> => {
        try {
            console.log("slug", slug);
            await this.initInstanceVariables({ res });
            const userInstance: IUser | null = await this.userService.findById({ _id: userId });

            if (userInstance === null) {
                throw new Error("User not found");
            }

            console.log(`User ${userId} connected via SSE for flow: ${slug}, type: ${flowType}`);
            this.activeSessions.set(userId, res);

            switch (flowType) {
                // Chatbot Flow
                case FlowTypeEnum.CHATBOT: {
                    this.processAIFlowConnection(userInstance, res);
                    break;
                }

                // Guided Flows
                case FlowTypeEnum.CHECK_IN: {
                    this.processGuidedFlowConnection(userInstance, res, slug, flowType);
                    break;
                }
                case FlowTypeEnum.ONBOARDING: {
                    this.processGuidedFlowConnection(userInstance, res, slug, flowType);
                    break;
                }
            }
            this.handleOnCloseSseConnection(userInstance, res, flowType, slug);
        } catch (error) {
            console.error("SSE connection error:", error);
            this.sendError(res, "Internal server error");
        }
    };

    createMessage = async (payload: Partial<IMessage>): Promise<IMessage> => {
        const messageInstance = await this.messageService.create(payload);
        return messageInstance;
    };

    getUserConnection = (userId: Types.ObjectId): Response | undefined => {
        const userSession: Response | undefined = this.activeSessions.get(userId.toString());
        return userSession;
    };

    processChatbotResponse = async (
        userInstance: IUser,
        message: string,
    ): Promise<{ success: boolean; message: string }> => {
        try {
            console.log(`Processing chatbot message from user ${userInstance._id}`);
            const conversationId = await this.getOrCreateChatbotConversation(userInstance);
            await this.createMessage({
                conversationId: conversationId,
                userId: userInstance._id as unknown as string,
                role: MessageRoleEnum.USER,
                type: MessageTypeEnum.AI,
                text: message,
                rich: null,
                attachments: null,
                ai: null,
                guided: null,
            });
            console.log(`User chatbot message saved`);
            const llmResponse = await this.llmService.sendUserQuery(userInstance, message);
            await conversationModel.findByIdAndUpdate(conversationId, {
                lastMessageAt: new Date(),
            });
            const userSession = this.getUserConnection(userInstance._id as any);
            if (userSession) {
                const aiLlmResponse: AILLMResponse = {
                    type: "chatbot_message",
                    text: llmResponse.answer as string,
                    timestamp: Date.now(),
                    response: llmResponse,
                };
                this.writeToSse(userSession, aiLlmResponse);
            }
            return {
                success: true,
                message: "Chatbot message processed successfully",
            };
        } catch (error) {
            console.error("Error handling chatbot message:", error);
            throw error;
        }
    };

    validateResponseArgs = (selectedKeys: number[], freeText?: string): boolean => {
        if (!selectedKeys && !freeText) {
            throw new Error("Either selectedKeys or freeText must be provided");
        }
        return true;
    };

    getCurrentNodeId = (flowDefinition: IFlowDefinition, nodeId: string): IFlowNode | undefined => {
        const currentNode = flowDefinition.nodes.find((n) => n.id === nodeId);
        return currentNode;
    };

    getFlowDetails = async (
        userInstance: IUser,
        flowInstanceId: string,
        nodeId: string,
    ): Promise<{
        currentNode: IFlowNode;
        flowDefinition: IFlowDefinition;
        flowInstance: IFlowInstance;
    }> => {
        const flowInstance = await this.flowInstanceService.findOne({
            filter: {
                _id: flowInstanceId,
                userId: userInstance._id,
                state: FlowInstanceStateEnum.ACTIVE,
            },
        });
        if (!flowInstance) {
            throw new Error("Flow instance not found");
        }

        if (flowInstance.cursorNodeId !== nodeId) {
            throw new Error(
                `Wrong question. Expected: ${flowInstance.cursorNodeId}, Got: ${nodeId}`,
            );
        }

        const flowDefinition = await this.findById({
            _id: flowInstance.flowDefId as unknown as string,
        });

        if (!flowDefinition) {
            throw new Error("FlowDefinition not found");
        }

        const currentNode = this.getCurrentNodeId(flowDefinition, nodeId);
        if (!currentNode) {
            throw new Error("Node not found");
        }

        return {
            currentNode,
            flowDefinition,
            flowInstance,
        };
    };

    getAnswerDetails = (
        currentNode: IFlowNode,
        selectedKeys: number[],
        freeText?: string,
    ): {
        answerType: AnswerTypeEnum;
        answerData: any;
    } => {
        let answerType: AnswerTypeEnum;
        if (freeText) {
            answerType = AnswerTypeEnum.FREE;
        } else if (currentNode.nodeType === "QUESTION_SINGLE") {
            answerType = AnswerTypeEnum.SINGLE;
        } else if (currentNode.nodeType === "QUESTION_MULTI") {
            answerType = AnswerTypeEnum.MULTI;
        } else {
            answerType = AnswerTypeEnum.FREE;
        }

        const answerData: AnswerData = { type: answerType, selectedKeys: [], freeText: null };
        if (freeText) {
            answerData.freeText = freeText;
        } else {
            answerData.selectedKeys = [...selectedKeys];
        }

        return { answerType, answerData };
    };

    insertAnswer = async (
        userInstance: IUser,
        flowInstance: IFlowInstance,
        nodeId: string,
        answerData: AnswerData,
        currentNode: IFlowNode,
    ) => {
        await this.flowResponseService.create({
            flowInstanceId: flowInstance._id,
            flowDefId: flowInstance.flowDefId,
            nodeId: nodeId,
            answer: answerData,
            computed: null,
        });

        console.log(`Answer saved to FlowResponse`);

        const userAnswerText =
            answerData.freeText ||
            currentNode.options
                .filter((opt) => answerData.selectedKeys?.includes(opt.score!))
                .map((o) => o.label)
                .join(", ");

        await this.messageService.create({
            conversationId: flowInstance.conversationId,
            userId: userInstance._id as unknown as string,
            role: MessageRoleEnum.USER,
            type: MessageTypeEnum.GUIDED,
            text: userAnswerText,
            rich: null,
            attachments: null,
            ai: null,
            guided: {
                flowInstanceId: flowInstance._id,
                nodeId: nodeId,
                optionKey:
                    (answerData.freeText as string) ||
                    (answerData.selectedKeys?.join(",") as string),
            },
        });

        console.log(`User message saved to conversation`);

        // SPECIAL VALIDATION FOR NAME NODE
        console.log(` Checking special validations for node ${nodeId}`);
    };

    completeFlowInstance = async (flowInstance: any) => {
        flowInstance.cursorNodeId = null;
        flowInstance.state = FlowInstanceStateEnum.COMPLETED;
        await flowInstance.save();
    };

    completeCheckinFlow = async (userInstance: IUser, flowInstance: IFlowInstance) => {
        const indicators = await transformFlowResponsesToIndicators(flowInstance._id.toString());

        console.log(`Publishing score job to Redis...`);
        await redisPublisherService.publishScoreJob(
            userInstance._id as unknown as string,
            indicators,
            userInstance.FCM_token as string,
            flowInstance._id.toString(),
        );
    };

    completeOnboardingFlow = async (userInstance: IUser) => {
        console.log(
            `Onboarding completed for user ${userInstance._id}. Update is_onboarded in users collection`,
        );

        const flowDeninition = await flowDefinitionModel.findOne({
            slug: ONBOARDING_SLUG,
            status: "PUBLISHED",
        });

        if (!flowDeninition) {
            console.error(`Default flow "${ONBOARDING_SLUG}" not found or not published.`);
            return;
        }
        const updatedUserInstance = await this.userService.findById({
            _id: userInstance._id as unknown as string,
        });
        if (!updatedUserInstance) {
            throw new Error("User not found");
        }
        this.flowInstanceService.createNewFlowForUser(updatedUserInstance, flowDeninition);

        await this.userService.findByIdAndUpdate({
            _id: updatedUserInstance._id as unknown as string,
            payload: {
                is_onboarded: {
                    is_questionnaire_completed: true,
                    is_subscription_completed:
                        updatedUserInstance.is_onboarded.is_subscription_completed,
                },
            },
        });
    };

    processGuidedResponse = async (
        userInstance: IUser,
        flowInstanceId: string,
        nodeId: string,
        flowType: FlowType,
        selectedKeys: number[],
        freeText?: string,
    ) => {
        this.validateResponseArgs(selectedKeys, freeText);
        const { currentNode, flowDefinition, flowInstance } = await this.getFlowDetails(
            userInstance,
            flowInstanceId,
            nodeId,
        );
        console.log("222");
        const { answerData } = this.getAnswerDetails(currentNode, selectedKeys, freeText);
        console.log("333");
        await this.insertAnswer(userInstance, flowInstance, nodeId, answerData, currentNode);
        const specialCaseNode = await this.handleSpecialNodeCase(
            userInstance,
            flowInstance,
            flowDefinition,
            nodeId,
            flowType,
            freeText,
            nodeId,
        );
        console.log("444", specialCaseNode);
        if (specialCaseNode?.success === false) {
            // Invalid input - question already re-sent, just return
            return {
                success: false,
                message: specialCaseNode.message,
            };
        } else if (specialCaseNode?.success) {
            // Valid input - use detected name
            freeText = specialCaseNode.data as string;
            // Update answerData with corrected name
            answerData.freeText = freeText;
        }
        console.log("555", flowType);
        if (flowType === "ONBOARDING") {
            console.log("666", nodeId);

            await this.updateOnboardingData(
                userInstance._id as unknown as string,
                flowDefinition,
                nodeId,
                selectedKeys,
                freeText,
            );
        }
        if (flowType === "CHECK_IN" && currentNode.indicator === "Lactation Status") {
            if (selectedKeys?.includes(STOPPED_BREASTFEEDING_SCORE)) {
                console.log(
                    `User ${userInstance._id} stopped breastfeeding. Updating user record...`,
                );
                await this.userService.findByIdAndUpdate({
                    _id: userInstance._id as unknown as string,
                    payload: {
                        is_breastfeeding_currently: false,
                    },
                });
            }
        }
        const nextNodeId = await this.findNextValidNode(
            userInstance._id as unknown as string,
            flowInstance,
            flowDefinition,
            currentNode.next,
            flowType,
        );
        console.log("777", nextNodeId);

        if (!nextNodeId) {
            await this.completeFlowInstance(flowInstance);
            const userConnection = this.getUserConnection(userInstance._id as any);
            if (userConnection) {
                await this.sendThankYouMessage(
                    userInstance._id as unknown as string,
                    flowInstance,
                    userConnection,
                    flowType,
                );
            }
            switch (flowType) {
                case FlowTypeEnum.CHECK_IN: {
                    await this.completeCheckinFlow(userInstance, flowInstance);
                }
                case FlowTypeEnum.ONBOARDING: {
                    await this.completeOnboardingFlow(userInstance);
                }
            }
            if (userConnection) {
                this.endFlow(userInstance._id as unknown as string, userConnection, flowType);
            }
            return {
                success: true,
                message:
                    flowType === "ONBOARDING"
                        ? "Onboarding completed!"
                        : "Check-in completed. Score processing initiated.",
            };
        } else {
            flowInstance.cursorNodeId = nextNodeId;
            await (flowInstance as any).save();
            console.log(`Moving cursor to: ${nextNodeId}`);
            console.log("8888", flowInstance.cursorNodeId);
            this.deletePendingQuestion(userInstance);

            const userConnection = this.getUserConnection(userInstance._id as any);
            console.log("8888", userConnection, userInstance._id, this.activeSessions.keys());
            if (userConnection) {
                await this.sendCurrentQuestion(
                    userInstance,
                    userConnection,
                    flowInstance,
                    flowDefinition,
                    flowType,
                );
            } else {
                await this.sendSilentPush(
                    userInstance._id as unknown as string,
                    flowInstance,
                    flowDefinition,
                    flowType,
                );
            }

            this.pendingQuestions.set(userInstance._id as unknown as string, {
                questionId: nextNodeId,
            });
            return { success: true, message: "Answer saved, fetching next question" };
        }
    };

    handleSpecialNodeCase = async (
        userInstance: IUser,
        flowInstance: IFlowInstance,
        flowDefinition: IFlowDefinition,
        nodeId: string,
        flowType: FlowType,
        freeText?: string,
        idOverride?: string,
    ) => {
        console.log(flowType, nodeId, freeText, "2.55555");
        if (flowType !== FlowTypeEnum.ONBOARDING || nodeId !== "name") {
            return;
        }
        if (!freeText) {
            throw new Error("Free text not found");
        }
        // 1. Call your LLM API to validate name
        const { has_name, detected_name } = await this.llmService.sendNameQuery(freeText);
        console.log(` LLM response: ${JSON.stringify({ has_name, detected_name })}`);
        if (!has_name) {
            await flowResponseModel.deleteOne({
                flowInstanceId: flowInstance._id,
                nodeId: nodeId,
            });
            //console.log("LLM could not detect a valid name. Asking question again.");
            this.deletePendingQuestion(userInstance);
            // send same question again
            const userConnection = this.getUserConnection(userInstance._id as any);
            console.log(` User connection: ${userConnection}`);
            if (userConnection) {
                await this.sendCurrentQuestion(
                    userInstance,
                    userConnection,
                    flowInstance,
                    flowDefinition,
                    flowType,
                    getUuid(),
                    NAME_QUERY,
                );
            } else {
                await this.sendSilentPush(
                    userInstance._id as unknown as string,
                    flowInstance,
                    flowDefinition,
                    flowType,
                );
            }

            // IMPORTANT: Keep cursor on same node
            // And DO NOT save answer
            return {
                success: false,
                message: "Invalid name. Asking again.",
                data: null,
            };
        }

        // If name is valid, override the freeText with LLM's detected name
        const specialCaseNodeResponse = {
            success: true,
            message: "Invalid name. Asking again.",
            data: detected_name,
        };
        return specialCaseNodeResponse;
    };

    saveResponse = async (
        userId: string,
        flowInstanceId: string,
        nodeId: string,
        flowType: FlowType,
        selectedKeys: number[],
        freeText?: string,
    ) => {
        try {
            const userInstance: IUser | null = await this.userService.findById({ _id: userId });
            if (!userInstance) {
                throw new Error("User not found");
            }
            console.log("0000", flowType);
            switch (flowType) {
                case FlowTypeEnum.CHATBOT: {
                    if (!freeText) {
                        throw new Error("Message text is required for chatbot");
                    }
                    await this.processChatbotResponse(userInstance, freeText);
                    return;
                }
                case FlowTypeEnum.CHECK_IN: {
                    console.log("111");
                    await this.processGuidedResponse(
                        userInstance,
                        flowInstanceId,
                        nodeId,
                        flowType,
                        selectedKeys,
                        freeText,
                    );
                    return;
                }
                case FlowTypeEnum.ONBOARDING: {
                    console.log("111");
                    await this.processGuidedResponse(
                        userInstance,
                        flowInstanceId,
                        nodeId,
                        flowType,
                        selectedKeys,
                        freeText,
                    );
                    return;
                }
            }
        } catch (error) {
            console.error("Error saving answer:", error);
            throw error;
        }
    };

    public async saveAnswer(
        userId: string,
        flowInstanceId: string,
        nodeId: string,
        flowType: FlowType,
        selectedKeys?: number[],
        freeText?: string,
    ): Promise<{ success: boolean; message: string } | void> {
        try {
            // ===== CHATBOT FLOW =====
            if (flowType === "CHATBOT") {
                if (!freeText) {
                    throw new Error("Message text is required for chatbot");
                }
                return await this.handleChatbotMessage(userId, freeText);
            }

            // ===== GUIDED FLOWS (ONBOARDING/CHECK-IN) =====
            if (!selectedKeys && !freeText) {
                throw new Error("Either selectedKeys or freeText must be provided");
            }

            const user = await UserModel.findOne({ _id: userId });

            const flowInstance = await flowInstanceModel.findOne({
                _id: flowInstanceId,
                userId: userId,
                state: FlowInstanceStateEnum.ACTIVE,
            });

            if (!flowInstance) {
                throw new Error("FlowInstance not found or already completed");
            }

            if (flowInstance.cursorNodeId !== nodeId) {
                throw new Error(
                    `Wrong question. Expected: ${flowInstance.cursorNodeId}, Got: ${nodeId}`,
                );
            }

            const flowDefinition = await flowDefinitionModel.findById(flowInstance.flowDefId);
            if (!flowDefinition) {
                throw new Error("FlowDefinition not found");
            }

            const currentNode = flowDefinition.nodes.find((n) => n.id === nodeId);
            if (!currentNode) {
                throw new Error("Node not found");
            }

            let answerType: AnswerTypeEnum;
            if (freeText) {
                answerType = AnswerTypeEnum.FREE;
            } else if (currentNode.nodeType === "QUESTION_SINGLE") {
                answerType = AnswerTypeEnum.SINGLE;
            } else if (currentNode.nodeType === "QUESTION_MULTI") {
                answerType = AnswerTypeEnum.MULTI;
            } else {
                answerType = AnswerTypeEnum.FREE;
            }

            const answerData: any = { type: answerType };

            if (freeText) {
                answerData.freeText = freeText;
            } else {
                answerData.selectedKeys = selectedKeys;
            }

            await new flowResponseModel({
                flowInstanceId: flowInstance._id,
                flowDefId: flowInstance.flowDefId,
                nodeId: nodeId,
                answer: answerData,
                computed: null,
            }).save();

            console.log(`Answer saved to FlowResponse`);

            const userAnswerText =
                freeText ||
                currentNode.options
                    .filter((opt) => selectedKeys?.includes(opt.score!))
                    .map((o) => o.label)
                    .join(", ");

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
                    optionKey: freeText || selectedKeys?.join(","),
                },
            }).save();

            console.log(`User message saved to conversation`);

            // SPECIAL VALIDATION FOR NAME NODE
            console.log(` Checking special validations for node ${nodeId}`);
            // if (flowType === "ONBOARDING" && nodeId === "name") {
            //     // 1. Call your LLM API to validate name
            //     const llmRes = await axios.get(
            //         `http://192.168.1.20:8001/chat/username?response=${encodeURIComponent(freeText || "")}`,
            //     );
            //     console.log(` LLM response: ${JSON.stringify(llmRes.data)}`);
            //     const { detected_name, has_name } = llmRes.data;

            //     if (!has_name) {
            //         console.log("LLM could not detect a valid name. Asking question again.");
            //         this.pendingQuestions.delete(userId);

            //         // send same question again
            //         const userConnection = this.activeSessions.get(userId);
            //         console.log(` User connection: ${userConnection}`);
            //         if (userConnection) {
            //             await this.sendCurrentQuestion(
            //                 userId,
            //                 flowInstance,
            //                 flowDefinition,
            //                 userConnection,
            //                 flowType,
            //                 uuidv4(),
            //                 "Please provide a valid name so we can address you properly.",
            //             );
            //         } else {
            //             await this.sendSilentPush(userId, flowInstance, flowDefinition, flowType);
            //         }

            //         // IMPORTANT: Keep cursor on same node
            //         // And DO NOT save answer
            //         return {
            //             success: false,
            //             message: "Invalid name. Asking again.",
            //         };
            //     }

            //     // If name is valid, override the freeText with LLM's detected name
            //     freeText = detected_name;
            // }

            // FOR ONBOARDING: Update user profile with onboarding data
            if (flowType === "ONBOARDING") {
                await this.updateOnboardingData(
                    userId,
                    flowDefinition,
                    nodeId,
                    selectedKeys,
                    freeText,
                );
            }

            // FOR CHECK-IN: Check for breastfeeding status change
            if (flowType === "CHECK_IN" && currentNode.indicator === "Lactation Status") {
                if (selectedKeys?.includes(STOPPED_BREASTFEEDING_SCORE)) {
                    console.log(`User ${userId} stopped breastfeeding. Updating user record...`);
                    await UserModel.findByIdAndUpdate(userId, {
                        is_breastfeeding_currently: false,
                    });
                }
            }

            const nextNodeId = await this.findNextValidNode(
                userId,
                flowInstance,
                flowDefinition,
                currentNode.next,
                flowType,
            );

            if (!nextNodeId) {
                console.log(`FLOW COMPLETE FOR USER ${userId}`);

                flowInstance.cursorNodeId = null;
                flowInstance.state = FlowInstanceStateEnum.COMPLETED;
                await flowInstance.save();

                const userConnection = this.activeSessions.get(userId);
                if (userConnection) {
                    await this.sendThankYouMessage(userId, flowInstance, userConnection, flowType);
                }

                if (flowType === "CHECK_IN") {
                    console.log(`Transforming flow responses to indicators...`);
                    const indicators = await transformFlowResponsesToIndicators(
                        flowInstance._id.toString(),
                    );

                    console.log(`Publishing score job to Redis...`);
                    await redisPublisherService.publishScoreJob(
                        userId,
                        indicators,
                        user?.FCM_token as string,
                        flowInstance._id.toString(),
                    );
                    console.log(`Score processing job published.\n`);
                }

                // FOR ONBOARDING: Update user collection to mark onboarding as complete
                if (flowType === "ONBOARDING") {
                    console.log(
                        `Onboarding completed for user ${userId}. Update is_onboarded in users collection`,
                    );

                    const flowDeninition = await flowDefinitionModel.findOne({
                        slug: ONBOARDING_SLUG,
                        status: "PUBLISHED",
                    });

                    if (!flowDeninition) {
                        console.error(
                            `Default flow "${ONBOARDING_SLUG}" not found or not published.`,
                        );
                        return;
                    }
                    const user = (await UserModel.findById(userId)) as IUser;
                    this.flowInstanceService.createNewFlowForUser(user, flowDeninition);

                    await UserModel.findByIdAndUpdate(userId, {
                        is_breastfeeding_currently: true,
                        is_onboarded: {
                            is_questionnaire_completed: true,
                            is_subscription_completed: user?.is_onboarded.is_subscription_completed,
                        },
                    });
                }

                if (userConnection) {
                    this.endFlow(userId, userConnection, flowType);
                }

                return {
                    success: true,
                    message:
                        flowType === "ONBOARDING"
                            ? "Onboarding completed!"
                            : "Check-in completed. Score processing initiated.",
                };
            }

            flowInstance.cursorNodeId = nextNodeId;
            await flowInstance.save();
            console.log(`Moving cursor to: ${nextNodeId}`);

            this.pendingQuestions.delete(userId);

            const userConnection = this.activeSessions.get(userId);
            if (userConnection) {
                // await this.sendCurrentQuestion(
                //     userConnection,
                //     flowInstance,
                //     flowDefinition,
                //     flowType,
                // );
            } else {
                await this.sendSilentPush(userId, flowInstance, flowDefinition, flowType);
            }

            this.pendingQuestions.set(userId, { questionId: nextNodeId });

            return { success: true, message: "Answer saved, fetching next question" };
        } catch (error: any) {
            console.error("Error saving answer:", error);
            throw error;
        }
    }

    // ===== NEW METHOD: Handle Chatbot Messages =====
    private async handleChatbotMessage(
        userId: string,
        message: string,
    ): Promise<{ success: boolean; message: string }> {
        try {
            console.log(`Processing chatbot message from user ${userId}`);

            // Get or create chatbot conversation
            const conversationId = await this.getOrCreateChatbotConversation({} as any);

            // Save user message
            await new messageModel({
                conversationId: conversationId,
                userId: userId,
                role: MessageRoleEnum.USER,
                type: MessageTypeEnum.AI,
                text: message,
                rich: null,
                attachments: null,
                ai: null,
                guided: null,
            }).save();

            console.log(`User chatbot message saved`);

            // Get AI response from your LLM service
            const aiResponse = await this.getAIResponse(userId, message);

            // Save AI message
            await new messageModel({
                conversationId: conversationId,
                userId: userId,
                role: MessageRoleEnum.ASSITANT,
                type: MessageTypeEnum.AI,
                text: aiResponse,
                rich: null,
                attachments: null,
                ai: null,
                guided: null,
            }).save();

            console.log(`AI response saved`);

            // Update conversation timestamp
            await conversationModel.findByIdAndUpdate(conversationId, {
                lastMessageAt: new Date(),
            });

            // Send AI response via SSE
            const userConnection = this.activeSessions.get(userId);
            if (userConnection) {
                const payload = {
                    type: "chatbot_message",
                    text: aiResponse,
                    timestamp: Date.now(),
                };
                userConnection.write(`data: ${JSON.stringify(payload)}\n\n`);
                console.log(`AI response sent via SSE`);
            }

            return {
                success: true,
                message: "Chatbot message processed successfully",
            };
        } catch (error: any) {
            console.error("Error handling chatbot message:", error);
            throw error;
        }
    }

    // ===== NEW METHOD: Get or Create Chatbot Conversation =====
    private async getOrCreateChatbotConversation(
        userInstance: IUser,
    ): Promise<Schema.Types.ObjectId> {
        let conversation = await conversationModel.findOne({
            userId: userInstance._id,
            chatMode: "AI_ONLY",
            "meta.tags": "chatbot",
        });

        if (!conversation) {
            console.log(`Creating new chatbot conversation for user ${userInstance._id}`);
            conversation = await new conversationModel({
                userId: userInstance._id,
                title: "Chat with AI Assistant",
                chatMode: "AI_ONLY",
                lastMessageAt: new Date(),
                meta: {
                    channel: "App",
                    tags: ["chatbot"],
                },
            }).save();
        }

        return conversation._id;
    }

    // Get AI Response
    private async getAIResponse(userId: string, message: string): Promise<string> {
        // TODO: Implement  LLM service integration
        // Example:
        // const response = await axios.post('YOUR_LLM_ENDPOINT', {
        //     userId: userId,
        //     message: message,
        // });
        // return response.data.message;

        return `This is a placeholder AI response to: "${message}". Please integrate your LLM service here.`;
    }

    private async updateOnboardingData(
        userId: string,
        flowDefinition: any,
        nodeId: string,
        selectedKeys?: number[],
        freeText?: string,
    ): Promise<void> {
        try {
            const user = await UserModel.findById(userId);
            if (!user) {
                throw new Error("User not found");
            }

            const node = flowDefinition.nodes.find((n: IFlowNode) => n.id === nodeId);

            switch (nodeId) {
                case "intro":
                    break;

                case "name":
                    user.onboarding_data.preferred_name = freeText as string;
                    console.log(`Saved preferred_name: ${freeText}`);
                    break;

                case "dob":
                    const dobDate = new Date(freeText!);
                    user.onboarding_data.date_of_birth = dobDate;
                    console.log(`Saved date_of_birth: ${dobDate}`);
                    break;

                case "location":
                    user.onboarding_data.location = freeText as string;
                    console.log(`Saved location: ${freeText}`);
                    break;

                case "conception":
                    const conception = this.getOptionValuesByScores(node, selectedKeys);
                    if (conception[0]) {
                        user.onboarding_data.conception_method = conception[0] as ConceptionMethod;
                        console.log(`Saved conception_method: ${conception[0]}`);
                    }
                    break;

                case "pregnancy_conditions":
                    const conditions = this.getOptionValuesByScores(node, selectedKeys);
                    user.onboarding_data.pregnancy_conditions =
                        conditions as PregnancyConditionEnum[];
                    console.log(`Saved pregnancy_conditions: ${conditions.join(", ")}`);
                    break;

                case "delivery_date":
                    if (freeText == "not_pragnent") {
                        user.onboarding_data.is_not_pragnant_yet = true;
                        user.user_category = EUserCategory.NN;
                        break;
                    }
                    const deliveryDate = new Date(freeText!);
                    user.onboarding_data.delivery_date = deliveryDate;
                    const user_current_week_and_days = calculateUserCurrentWeek(deliveryDate);

                    user.user_category =
                        user_current_week_and_days.mode === "pregnancy"
                            ? EUserCategory.NP
                            : EUserCategory.PP;

                    await UserModel.findOneAndUpdate(
                        { _id: user._id },
                        { $set: { current_weekdays: user_current_week_and_days } },
                        { new: true },
                    );
                    user.onboarding_data.is_not_pragnant_yet = false;
                    console.log(
                        `Saved delivery_date: ${deliveryDate}, week: ${user_current_week_and_days.weeks}`,
                    );
                    break;

                case "delivery_type":
                    const deliveryType = this.getOptionValuesByScores(node, selectedKeys);
                    if (deliveryType[0]) {
                        user.onboarding_data.delivery_type = deliveryType[0] as DeliveryTypeEnum;
                        console.log(`Saved delivery_type: ${deliveryType[0]}`);
                    }
                    break;

                case "delivery_outcome":
                    const outcome = this.getOptionValuesByScores(node, selectedKeys);
                    if (outcome[0]) {
                        user.onboarding_data.delivery_outcome = outcome[0] as DeliveryOutcomeEnum;
                        console.log(`Saved delivery_outcome: ${outcome[0]}`);
                    }
                    break;

                case "meds_history":
                    const historyMeds = this.getOptionValuesByScores(node, selectedKeys);
                    user.onboarding_data.past_medications = historyMeds as PastMedicationEnum[];
                    console.log(`Saved past_medications: ${historyMeds.join(", ")}`);
                    break;

                case "current_meds":
                    const currentMeds = this.getOptionValuesByScores(node, selectedKeys);
                    user.onboarding_data.current_medications =
                        currentMeds as CurrentMedicationEnum[];
                    console.log(`Saved current_medications: ${currentMeds.join(", ")}`);
                    break;

                case "smoking":
                    const smoking = this.getOptionValuesByScores(node, selectedKeys);
                    if (smoking[0]) {
                        user.onboarding_data.tobacco_use = smoking[0] as TobaccoUseEnum;
                        console.log(`Saved tobacco_use: ${smoking[0]}`);
                    }
                    break;

                case "alcohol":
                    const alcohol = this.getOptionValuesByScores(node, selectedKeys);
                    if (alcohol[0]) {
                        user.onboarding_data.alcohol_use = alcohol[0] as AlcoholUseEnum;
                        console.log(`Saved alcohol_use: ${alcohol[0]}`);
                    }
                    break;

                case "support":
                    const support = this.getOptionValuesByScores(node, selectedKeys);
                    if (support[0]) {
                        user.onboarding_data.social_support = support[0] as SocialSupportEnum;
                        console.log(`Saved social_support: ${support[0]}`);
                    }
                    break;

                case "parity":
                    const parity = this.getOptionValuesByScores(node, selectedKeys);
                    if (parity[0]) {
                        user.onboarding_data.parity = parity[0] as ParityEnum;
                        console.log(`Saved parity: ${parity[0]}`);
                    }
                    break;

                case "wrap_up":
                    user.is_onboarded.is_questionnaire_completed = true;
                    user.onboarding_data.onboarded_at = new Date();
                    console.log(`Onboarding marked as complete`);
                    break;
            }

            await user.save();
        } catch (error) {
            console.error(`Error updating onboarding data for nodeId ${nodeId}:`, error);
            throw error;
        }
    }

    private getOptionValuesByScores(node: IFlowNode, selectedKeys?: number[]): string[] {
        if (!selectedKeys || selectedKeys.length === 0) {
            return [];
        }

        return node.options
            .filter((opt) => selectedKeys.includes(opt.score!))
            .map((opt) => opt.value);
    }

    private async findNextValidNode(
        userId: string,
        flowInstance: any,
        flowDefinition: any,
        startingNodeId: string | null,
        flowType: FlowType,
    ): Promise<string | null> {
        if (flowType === "CHECK_IN") {
            let currentNodeId = startingNodeId;
            const user = await UserModel.findById(userId);
            const currentWeek = flowInstance.postpartumWeek;
            const isBreastfeeding = user?.is_breastfeeding_currently ?? true;

            console.log(`Finding next valid node starting from: ${currentNodeId}`);
            console.log(`Week: ${currentWeek}, Breastfeeding: ${isBreastfeeding}`);

            while (currentNodeId) {
                const node = flowDefinition.nodes.find((n: IFlowNode) => n.id === currentNodeId);

                if (!node) {
                    console.log(`Node ${currentNodeId} not found`);
                    return null;
                }

                console.log(`Checking node: ${node.id} (${node.indicator})`);

                if (!this.isNodeActiveForWeek(node, currentWeek)) {
                    console.log(`Skipping - Not active for week ${currentWeek}`);
                    currentNodeId = node.next;
                    continue;
                }

                if (!this.isNodeValidForBreastfeeding(node, isBreastfeeding)) {
                    console.log(`Skipping - Not breastfeeding`);
                    currentNodeId = node.next;
                    continue;
                }

                const isEliminated = await this.isNodeEliminated(userId, node, flowInstance);
                if (isEliminated) {
                    console.log(`Skipping - Eliminated (scored 2 for 2 weeks)`);
                    currentNodeId = node.next;
                    continue;
                }

                console.log(`Valid node found: ${node.id}\n`);
                return currentNodeId;
            }

            console.log(`🏁 No more valid nodes - flow complete\n`);
            return null;
        }

        // ONBOARDING flow logic with pregnancy skip
        console.log(`Onboarding: checking if pregnancy-related questions should be skipped`);

        const user = await UserModel.findById(userId);
        const isNotPregnantYet = user?.onboarding_data?.is_not_pragnant_yet ?? false;

        let currentNodeId = startingNodeId;

        while (currentNodeId) {
            const node = flowDefinition.nodes.find((n: IFlowNode) => n.id === currentNodeId);

            if (!node) {
                console.log(`Node ${currentNodeId} not found`);
                return null;
            }

            if (isNotPregnantYet && this.isPregnancyRelatedNode(node.id)) {
                console.log(`Skipping pregnancy related node: ${node.id} (user not pregnant yet)`);
                currentNodeId = node.next;
                continue;
            }

            if (!isNotPregnantYet && this.isFutureDeliveryRalatedNode(node.id)) {
                const deliveryDate = user?.onboarding_data?.delivery_date;
                if (deliveryDate) {
                    const postpartumWeek = calculateUserCurrentWeek(deliveryDate);
                    if (postpartumWeek.mode == "pregnancy") {
                        console.log(
                            `Skipping delivery_date node: ${node.id} (delivery date in future)`,
                        );
                        currentNodeId = node.next;
                        continue;
                    }
                }
            }

            console.log(`Valid onboarding node found: ${node.id}`);
            return currentNodeId;
        }

        console.log(`No more valid nodes - onboarding complete\n`);
        return null;
    }

    private isPregnancyRelatedNode(nodeId: string): boolean {
        const pregnancyRelatedNodes = [
            "conception",
            "pregnancy_conditions",
            "delivery_type",
            "delivery_outcome",
            "parity",
        ];

        return pregnancyRelatedNodes.includes(nodeId);
    }

    private isFutureDeliveryRalatedNode = (nodeId: string) => {
        const futureDeliveryRelatedNodes = ["delivery_type", "delivery_outcome"];

        return futureDeliveryRelatedNodes.includes(nodeId);
    };

    private isNodeActiveForWeek(node: IFlowNode, currentWeek: number): boolean {
        if (node.validWeekStart === null && node.validWeekEnd === null) {
            return true;
        }

        const weekStart = node.validWeekStart ?? 1;
        const weekEnd = node.validWeekEnd ?? 52;

        return currentWeek >= weekStart && currentWeek <= weekEnd;
    }

    private isNodeValidForBreastfeeding(node: IFlowNode, isBreastfeeding: boolean): boolean {
        const breastfeedingDependentIndicators = ["Lactation Status", "Supplement Adherence"];

        if (breastfeedingDependentIndicators.includes(node.indicator)) {
            return isBreastfeeding;
        }

        return true;
    }

    private async isNodeEliminated(
        userId: string,
        node: IFlowNode,
        currentFlowInstance: any,
    ): Promise<boolean> {
        const eliminationIndicators = [
            "Lochia / Bleeding",
            "Perineal/C-section Wound",
            "Mobility/Movement",
            "Constipation",
        ];

        if (!eliminationIndicators.includes(node.indicator)) {
            return false;
        }

        const previousInstances = await flowInstanceModel
            .find({
                userId: userId,
                flowDefId: currentFlowInstance.flowDefId,
                state: FlowInstanceStateEnum.COMPLETED,
                _id: { $ne: currentFlowInstance._id },
            })
            .sort({ createdAt: -1 })
            .limit(2)
            .lean();

        if (previousInstances.length < 2) {
            return false;
        }

        const lastTwoScoresRaw = await Promise.all(
            previousInstances.map(async (instance) => {
                const response = await flowResponseModel.findOne({
                    flowInstanceId: instance._id,
                    nodeId: node.id,
                });

                if (
                    !response ||
                    !response.answer.selectedKeys ||
                    response.answer.selectedKeys.length === 0
                ) {
                    return null;
                }

                return response.answer.selectedKeys[0];
            }),
        );

        const lastTwoScores = lastTwoScoresRaw.map((s) => (s !== null ? Number(s) : null));
        const allScoresAreTwo = lastTwoScores.every((score) => score === 2);

        if (allScoresAreTwo) {
            console.log(
                `Elimination condition met for "${node.indicator}" - scored 2 for 2 consecutive weeks`,
            );
        }

        return allScoresAreTwo;
    }

    private async sendCurrentQuestion(
        userInstance: IUser,
        res: Response,
        flowInstance: IFlowInstance,
        flowDefinition: IFlowDefinition,
        flowType: FlowType,
        questionOvverideId?: string,
        questionTextOverride?: string,
    ): Promise<void> {
        if (!flowInstance.cursorNodeId) {
            this.endFlow(userInstance._id as unknown as string, res);
            return;
        }

        const validNodeId = await this.findNextValidNode(
            userInstance._id as unknown as string,
            flowInstance,
            flowDefinition,
            flowInstance.cursorNodeId,
            flowType,
        );
        console.log(`Next valid node: ${validNodeId}`);
        if (!validNodeId) {
            console.log(`No valid questions remaining for user ${userInstance._id}`);
            this.endFlow(userInstance._id as unknown as string, res);
            return;
        }

        if (validNodeId !== flowInstance.cursorNodeId) {
            flowInstance.cursorNodeId = validNodeId;
            await (flowInstance as any).save();
        }

        const currentNode = flowDefinition.nodes.find((n: IFlowNode) => n.id === validNodeId);

        if (!currentNode) {
            console.error(`Node ${validNodeId} not found`);
            this.endFlow(userInstance._id as unknown as string, res, flowType);
            return;
        }

        const formattedOptions = currentNode.options.map((opt: any) => ({
            id: opt.value,
            label: opt.label,
            value: opt.value,
            score: opt.score,
        }));

        const payload: QuestionPayload = {
            // uuid: questionOvverideId || uuidv4()
            type: QuestionSourceEnum.AI_Message,
            uuid: questionOvverideId,
            id: currentNode.id,
            flowInstanceId: flowInstance._id.toString(),
            text: questionTextOverride ? questionTextOverride : currentNode.text || "",
            educationalMessage: currentNode.educationalMessage || "",
            whyThisMatters: currentNode.whyThisMatters || "",
            options: formattedOptions,
            nodeType: currentNode.nodeType,
            askId: Date.now(),
        };

        console.log(`Prepared question payload: ${JSON.stringify(payload)}`, questionTextOverride);

        await new messageModel({
            conversationId: flowInstance.conversationId,
            userId: userInstance._id as unknown as string,
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

        res.write(`data: ${JSON.stringify(payload)}\n\n`);
        console.log(`Sent question via SSE: ${currentNode.id}`);
    }

    private async getOrCreateConversation(
        userInstance: IUser,
        flowType: FlowType,
    ): Promise<Schema.Types.ObjectId> {
        let title: string;
        let tag: string;

        if (flowType === "ONBOARDING") {
            title = "Onboarding";
            tag = "onboarding";
        } else if (flowType === "CHATBOT") {
            title = "Chat with AI Assistant";
            tag = "chatbot";
        } else {
            title = "Check-in";
            tag = "check-in";
        }

        const chatMode = flowType === "CHATBOT" ? "AI_ONLY" : "GUIDED_ONLY";

        let conversation = await conversationModel.findOne({
            userId: userInstance._id,
            chatMode: chatMode,
            "meta.tags": tag,
        });

        if (!conversation) {
            conversation = await new conversationModel({
                userId: userInstance._id,
                title: title,
                chatMode: chatMode,
                lastMessageAt: new Date(),
                meta: {
                    channel: "App",
                    tags: [tag],
                },
            }).save();
        }

        return conversation._id;
    }

    private async sendThankYouMessage(
        userId: string,
        flowInstance: any,
        res: Response,
        flowType: FlowType,
    ): Promise<void> {
        let text = "";
        if (flowType === "ONBOARDING") {
            text =
                "Thank you! That gives me a clear picture of your health, support, and daily life. I will now build your personalised recovery plan and connect you with the right support.";
        } else {
            text =
                "Thank you for completing your check-in! Your score is being generated. Please check the dashboard.";
        }

        const thankYouMessage = {
            type: "end_flow",
            text: text,
            flowType: flowType,
            // uuid: uuidv4(),
        };

        await new messageModel({
            conversationId: flowInstance.conversationId,
            userId: userId,
            role: MessageRoleEnum.ASSITANT,
            type: MessageTypeEnum.GUIDED,
            text: text,
            rich: null,
            attachments: null,
            ai: null,
            guided: null,
        }).save();

        res.write(`data: ${JSON.stringify(thankYouMessage)}\n\n`);
        console.log(`Sent thank you message`);
        res.end();

        this.activeSessions.delete(userId);
        console.log(`Flow ended for user ${userId}`);
    }

    private endFlow(userId: string, res: Response, flowType?: FlowType): void {
        const endPayload: any = {
            text: "Flow completed",
            nodeType: FlowNodeEnum.END,
            flowType: flowType,
        };

        res.write(`data: ${JSON.stringify(endPayload)}\n\n`);
        res.end();

        this.activeSessions.delete(userId);
        console.log(`Flow ended for user ${userId}`);
    }

    private sendError(res: Response, message: string): void {
        const errorPayload = {
            type: "error",
            message: message,
        };

        res.write(`data: ${JSON.stringify(errorPayload)}\n\n`);
        res.end();
    }

    private async sendSilentPush(
        userId: string,
        flowInstance: any,
        flowDefinition: any,
        flowType: FlowType,
    ): Promise<void> {
        try {
            const user = await UserModel.findById(userId);
            if (!user || !user.FCM_token) {
                console.log(`No FCM token for user ${userId}`);
                return;
            }

            const validNodeId = await this.findNextValidNode(
                userId,
                flowInstance,
                flowDefinition,
                flowInstance.cursorNodeId,
                flowType,
            );

            if (!validNodeId) {
                console.log(`No valid questions for silent push`);
                return;
            }

            const currentNode = flowDefinition.nodes.find((n: IFlowNode) => n.id === validNodeId);

            if (!currentNode) {
                console.error(`Node not found for silent push`);
                return;
            }

            const formattedOptions = currentNode.options.map((opt: any) => ({
                id: opt.value,
                label: opt.label,
                value: opt.value,
                score: opt.score,
            }));

            const questionPayload: QuestionPayload = {
                askId: Date.now(),
                type: QuestionSourceEnum.AI_Message,
                id: currentNode.id,
                flowInstanceId: flowInstance._id.toString(),
                text: currentNode.text || "",
                educationalMessage: currentNode.educationalMessage || "",
                whyThisMatters: currentNode.whyThisMatters || "",
                options: formattedOptions,
                nodeType: currentNode.nodeType,
            };

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

            await admin!.messaging().send(message);
            console.log(`Sent silent push for question ${currentNode.id}`);

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
            console.error("Error sending silent push:", error);
        }
    }
}

export default ChatFlowService;
