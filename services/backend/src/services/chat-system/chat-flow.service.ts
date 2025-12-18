import { Response } from "express";
import { Schema } from "mongoose";
import admin from "../../config/firebase";
import conversationModel from "../../models/conversation.model";
import flowDefinitionModel from "../../models/flowDefinition.model";
import flowInstanceModel from "../../models/flowInstance.model";
import flowResponseModel from "../../models/flowResponse.model";
import messageModel from "../../models/message.model";
import {
    AIGreetingMessage,
    AnswerTypeEnum,
    EndFlowPayload,
    FlowInstanceStateEnum,
    FlowType,
    FlowTypeEnum,
    IFlowDefinition,
    IFlowInstance,
    IFlowNode,
    MessageRoleEnum,
    MessageTypeEnum,
    QuestionPayload,
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

const STOPPED_BREASTFEEDING_SCORE = -1;

class ChatFlowService extends BaseService<IFlowDefinition> {
    private activeSessions = new Map<string, Response>();
    private pendingQuestions = new Map<string, { questionId: string }>();
    private userInstance: IUser = {} as IUser;
    private flowInstanceService: FlowInstanceService;
    private userService: UserService;
    private res: Response = {} as Response;

    constructor() {
        super(flowDefinitionModel);
        this.flowInstanceService = new FlowInstanceService();
        this.userService = new UserService();
    }

    setResponse = (res: Response): void => {
        this.res = res;
    };

    setUserInstance = async (userId: string): Promise<void> => {
        this.userInstance = (await this.userService.findById({ _id: userId })) as IUser;
    };

    setSseConnection = (): void => {
        this.res.setHeader("Content-Type", "text/event-stream");
        this.res.setHeader("Cache-Control", "no-cache");
        this.res.setHeader("Connection", "keep-alive");
        this.res.flushHeaders();
    };

    writeToSse = (res: Response, payload: Record<string, unknown>): void => {
        res.write(`data: ${JSON.stringify(payload)}\n\n`);
    };

    sendInitialGreeting = async (): Promise<void> => {
        try {
            const {
                onboarding_data: { preferred_name },
            } = this.userInstance as IUser;

            const greeetingMessage: AIGreetingMessage = {
                type: "chatbot_message",
                text: getAIGreetingMessage(preferred_name || "there"),
                timestamp: Date.now(),
            };
            this.writeToSse(this.res, greeetingMessage);
        } catch (error) {
            throw error;
        }
    };

    processAIFlowConnection = async (): Promise<boolean> => {
        await this.getOrCreateChatbotConversation();
        await this.sendInitialGreeting();
        return true;
    };

    getPendingQuestion = (): { questionId: string } | undefined => {
        return this.pendingQuestions.get(this.userInstance._id as unknown as string);
    };

    deletePendingQuestion = (): void => {
        this.pendingQuestions.delete(this.userInstance._id as unknown as string);
    };

    sendGuidedFlowResponse = async (
        flowDefinition: IFlowDefinition,
        flowType: string,
        slug: string,
    ) => {
        let flowInstance = await this.flowInstanceService.findOne({
            filter: {
                userId: this.userInstance._id,
                flowDefId: flowDefinition._id,
                state: FlowInstanceStateEnum.ACTIVE,
            },
        });
        if (!flowInstance) {
            const conversationId = await this.getOrCreateConversation(flowType as FlowType);
            const startNodeId: string = flowDefinition.startNodeId;
            const currentWeek: number = this.userInstance.current_weekdays.weeks as number;

            flowInstance = await this.flowInstanceService.create({
                userId: this.userInstance._id,
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
            this.deletePendingQuestion();
        }
        this.sendCurrentQuestion(flowInstance, flowDefinition, flowType as FlowType);
    };

    processGuidedFlowConnection = async (slug: string, flowType: FlowType): Promise<boolean> => {
        const flowDefinition = await this.findOne({
            filter: { slug: slug, status: "PUBLISHED" },
        });
        if (!flowDefinition) {
            throw new Error("Flow not found");
        }

        const pendingQuestion = this.getPendingQuestion();
        if (pendingQuestion) {
            console.log(
                `User ${this.userInstance._id} reconnected with pending question: ${pendingQuestion.questionId}. ` +
                    `Question already sent - waiting for user to submit answer. No new question will be sent.`,
            );
            return false;
        }
        this.sendGuidedFlowResponse(flowDefinition, flowType, slug);
        return true;
    };

    initInstanceVariables = async ({
        res,
        userId,
    }: {
        res: Response;
        userId: string;
    }): Promise<void> => {
        this.setResponse(res);
        this.setSseConnection();
        await this.setUserInstance(userId);
    };

    sendSilentPushNotification = async (slug: string, flowType: FlowType): Promise<void> => {
        try {
            const flowInstance = await this.flowInstanceService.findOne({
                filter: {
                    userId: this.userInstance._id as unknown as string,
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
                this.userInstance._id as unknown as string,
                flowInstance,
                flowDefinition,
                flowType,
            );
        } catch (error) {
            console.error(`Error handling disconnect for ${this.userInstance._id}:`, error);
        }
    };

    handleOnCloseSseConnection = (flowType: FlowType, slug: string): void => {
        this.res.on("close", async () => {
            console.log(`User ${this.userInstance._id} disconnected`);
            this.activeSessions.delete(this.userInstance._id as unknown as string);
            if (flowType === FlowTypeEnum.CHATBOT) {
                return;
            }

            const pendingQuestion = this.getPendingQuestion();
            if (!pendingQuestion) {
                return;
            }

            this.deletePendingQuestion();

            await this.sendSilentPushNotification(slug, flowType);
        });
    };

    handleSseConnection = async (
        userId: string,
        slug: string,
        flowType: FlowType,
        res: Response,
    ): Promise<void> => {
        try {
            await this.initInstanceVariables({ res, userId });
            if (this.userInstance === null) {
                throw new Error("User not found");
            }

            console.log(`User ${userId} connected via SSE for flow: ${slug}, type: ${flowType}`);
            this.activeSessions.set(userId, res);

            switch (flowType) {
                // Chatbot Flow
                case FlowTypeEnum.CHATBOT: {
                    this.processAIFlowConnection();
                    break;
                }

                // Guided Flows
                case FlowTypeEnum.ONBOARDING || FlowTypeEnum.CHECK_IN: {
                    this.processGuidedFlowConnection(slug, flowType);
                    break;
                }
            }
            this.handleOnCloseSseConnection(flowType, slug);
        } catch (error) {
            console.error("SSE connection error:", error);
            this.sendError(res, "Internal server error");
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
                await this.sendCurrentQuestion(flowInstance, flowDefinition, flowType);
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
            const conversationId = await this.getOrCreateChatbotConversation(userId);

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
    private async getOrCreateChatbotConversation(): Promise<Schema.Types.ObjectId> {
        let conversation = await conversationModel.findOne({
            userId: this.userInstance?._id,
            chatMode: "AI_ONLY",
            "meta.tags": "chatbot",
        });

        if (!conversation) {
            console.log(`Creating new chatbot conversation for user ${this.userInstance?._id}`);
            conversation = await new conversationModel({
                userId: this.userInstance?._id,
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
        flowInstance: IFlowInstance,
        flowDefinition: IFlowDefinition,
        flowType: FlowType,
        questionOvverideId?: string,
        questionTextOverride?: string,
    ): Promise<void> {
        if (!flowInstance.cursorNodeId) {
            this.endFlow(this.userInstance._id as unknown as string, this.res);
            return;
        }

        const validNodeId = await this.findNextValidNode(
            this.userInstance._id as unknown as string,
            flowInstance,
            flowDefinition,
            flowInstance.cursorNodeId,
            flowType,
        );
        console.log(`Next valid node: ${validNodeId}`);
        if (!validNodeId) {
            console.log(`No valid questions remaining for user ${this.userInstance._id}`);
            this.endFlow(this.userInstance._id as unknown as string, this.res);
            return;
        }

        if (validNodeId !== flowInstance.cursorNodeId) {
            flowInstance.cursorNodeId = validNodeId;
            await flowInstance.save();
        }

        const currentNode = flowDefinition.nodes.find((n: IFlowNode) => n.id === validNodeId);

        if (!currentNode) {
            console.error(`Node ${validNodeId} not found`);
            this.endFlow(this.userInstance._id as unknown as string, this.res, flowType);
            return;
        }

        const formattedOptions = currentNode.options.map((opt: any) => ({
            id: opt.value,
            label: opt.label,
            value: opt.value,
            score: opt.score,
        }));

        const payload: QuestionPayload & { askId: any; uuid: any } = {
            // uuid: questionOvverideId || uuidv4()
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

        await new messageModel({
            conversationId: flowInstance.conversationId,
            userId: this.userInstance._id as unknown as string,
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

        this.res.write(`data: ${JSON.stringify(payload)}\n\n`);
        console.log(`Sent question via SSE: ${currentNode.id}`);
    }

    private async getOrCreateConversation(flowType: FlowType): Promise<Schema.Types.ObjectId> {
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
            userId: this.userInstance._id,
            chatMode: chatMode,
            "meta.tags": tag,
        });

        if (!conversation) {
            conversation = await new conversationModel({
                userId: this.userInstance._id,
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
            type: "completion_message",
            text: text,
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
    }

    private endFlow(userId: string, res: Response, flowType?: FlowType): void {
        const endPayload: EndFlowPayload = {
            type: "end_flow",
            message: "Flow completed",
            flowType: flowType!,
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
