import { Response } from "express";
import { ObjectId, Schema, Types } from "mongoose";
import admin from "../../config/firebase";
import conversationModel from "../../models/conversation.model";
import flowDefinitionModel from "../../models/flowDefinition.model";
import { IUser } from "../../types";
import {
    AIGreetingMessage,
    AILLMResponse,
    FlowNodeEnum,
    FlowType,
    IFlowDefinition,
    IMessage,
    MessageRoleEnum,
    MessageTypeEnum,
} from "../../types/chat.types";
import { getAIGreetingMessage } from "../../utils/commonFunctions/chatbot";
import { getUuid } from "../../utils/commonFunctions/uuid";
import BaseService from "../base.service";
import LLMService from "../llm/llm.service";
import MessageService from "../message/message.service";
import UserService from "../users/user.service";

class ChatFlowAIService extends BaseService<IFlowDefinition> {
    private activeSessions = new Map<string, Response>();
    private userService: UserService;
    private messageService: MessageService;
    private llmService: LLMService;

    constructor() {
        super(flowDefinitionModel);
        this.userService = new UserService();
        this.messageService = new MessageService();
        this.llmService = new LLMService();
    }

    setSseConnection = (res: Response): void => {
        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");
        res.flushHeaders();
    };

    initInstanceVariables = async ({ res }: { res: Response }): Promise<void> => {
        this.setSseConnection(res);
    };

    handleChatbotSSEConnection = async (
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
            this.processAIFlowConnection(userInstance, res);
            // this.handleOnCloseSseConnection(userInstance, res, flowType, slug);
        } catch (error) {
            console.error("SSE connection error in AI service:", error);
            this.sendError(res, "Internal server error");
        }
    };

    private sendError(res: Response, message: string): void {
        const errorPayload = {
            type: "error",
            message: message,
        };

        res.write(`data: ${JSON.stringify(errorPayload)}\n\n`);
        res.end();
    }

    writeToSse = (res: Response, payload: Record<string, unknown>): void => {
        res.write(`data: ${JSON.stringify(payload)}\n\n`);
    };

    sendInitialGreeting = async (userInstance: IUser, res: Response): Promise<void> => {
        try {
            const {
                onboarding_data: { preferred_name },
            } = userInstance as IUser;

            const greeetingMessage: AIGreetingMessage = {
                id: getUuid(),
                type: "ai_message",
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
        await this.sendInitialGreeting(userInstance, res);
        return true;
    };

    saveResponse = async (
        userId: string,
        freeText: string,
        sessionId: string,
        conversationId: ObjectId,
    ) => {
        console.log("SaveResponse in aiChat flow called!");
        try {
            const userInstance: IUser | null = await this.userService.findById({ _id: userId });
            if (!userInstance) {
                throw new Error("User not found");
            }
            if (!freeText) {
                throw new Error("Free text is required");
            }
            await this.processChatbotResponse(userInstance, freeText, sessionId, conversationId);
        } catch (error) {
            console.error("Error saving answer:", error);
            throw error;
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
        sessionId: string,
        conversationId: ObjectId,
    ): Promise<{ success: boolean; message: string }> => {
        try {
            console.log(`Processing chatbot message from user ${userInstance._id}`);
            if (!conversationId) {
                conversationId = await this.createChatbotConversation(userInstance);
            }
            // ✅ Generate unique session_id
            if (!sessionId) {
                sessionId = getUuid();
            }
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
            const llmResponse = await this.llmService.sendUserQuery(
                userInstance,
                message,
                sessionId,
            );
            const aiMessageInstance = await this.createMessage({
                conversationId: conversationId,
                userId: userInstance._id as unknown as string,
                role: MessageRoleEnum.ASSITANT,
                type: MessageTypeEnum.AI,
                text: llmResponse.answer as string,
                rich: null,
                attachments: null,
                ai: null,
                guided: null,
            });
            await conversationModel.findByIdAndUpdate(conversationId, {
                lastMessageAt: new Date(),
            });
            const userSession = this.getUserConnection(userInstance._id as any);
            const aiLlmResponse: AILLMResponse = {
                sessionId: sessionId,
                conversationId: conversationId,
                id: aiMessageInstance._id as unknown as string,
                type: "ai_message",
                text: llmResponse.answer as string,
                timestamp: Date.now(),
                response: llmResponse,
                nodeType: FlowNodeEnum.QUESTION_FREE_TEXT,
            };

            console.log("final aiLLMResponse is => ", aiLlmResponse);

            if (userSession) {
                this.writeToSse(userSession, aiLlmResponse);
            } else {
                // send silent push
                //this.sendSilentPush(userInstance._id as unknown as string, aiLlmResponse);
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

    private async createChatbotConversation(userInstance: IUser): Promise<Schema.Types.ObjectId> {
        console.log(`Creating new chatbot conversation for user ${userInstance._id}`);
        const conversation = await new conversationModel({
            userId: userInstance._id,
            title: "Chat with AI Assistant",
            chatMode: "AI_ONLY",
            lastMessageAt: new Date(),
            meta: {
                channel: "App",
                tags: ["chatbot"],
            },
        }).save();

        return conversation._id;
    }

    private async sendSilentPush(userId: string, messagePayload: AILLMResponse): Promise<void> {
        try {
            const user = await this.userService.findOne({ _id: userId });
            if (!user || !user.FCM_token) {
                console.log(`No FCM token for user ${userId}`);
                return;
            }

            const message = {
                data: {
                    type: "NEW_CHATBOT_RESPONSE",
                    questionData: JSON.stringify(messagePayload),
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
            console.log(`Sent silent push for user ${userId}`);
        } catch (error) {
            console.error("Error sending silent push:", error);
        }
    }
}

export default ChatFlowAIService;
