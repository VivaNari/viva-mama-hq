import mongoose from "mongoose";
import conversationModel from "../models/conversation.model";
import flowDefinitionModel from "../models/flowDefinition.model";
import UserModel from "../models/user.model";
import { sendPushNotification } from "../utils/sendPushNotification";
import flowInstanceModel from "../models/flowInstance.model";
import { FlowInstanceStateEnum, IConversation, IFlowDefinition } from "../types/chat.types";
import { IUser } from "../types/index";

const DEFAULT_ONBOARDING_SLUG = "onboarding-check-in-v1";

const REMINDER_TIME_MS = 30 * 60 * 1000;

const createNewFlowForUser = async (
    user: IUser,
    flowDef: IFlowDefinition,
): Promise<IConversation | null> => {
    try {
        const newConversation = await conversationModel.create({
            userId: user._id,
            title: flowDef.name,
            chatMode: "GUIDED_ONLY",
            lastMessageAt: new Date(),
            meta: {
                channel: "App",
                tags: [flowDef.slug],
            },
        });

        await flowInstanceModel.create({
            userId: user._id,
            conversationId: newConversation._id,
            flowDefId: flowDef._id,
            flowSlug: flowDef.slug,
            version: flowDef.version,
            state: FlowInstanceStateEnum.ACTIVE,
            cursorNodeId: flowDef.startNodeId,
            variables: {},
            outcome: null,
        });

        console.log(`Created new flow instance for user ${user._id}`);
        return newConversation;
    } catch (error) {
        console.error(`Error creating new flow for user ${user._id}:`, error);
        return null;
    }
};

const processUser = async (user: IUser) => {
    console.log(`Processing user: ${user.email ? user.email : user.mobile_number}`);
    if (!user.FCM_token) {
        console.warn(
            `User ${user.email ? user.email : user.mobile_number} has no FCM token. Skipping.`,
        );
        return;
    }

    const lastInstance = await flowInstanceModel
        .findOne({ userId: user._id })
        .sort({ createdAt: -1 });

    if (!lastInstance) {
        console.log(
            `No flow instance found for user ${user.email ? user.email : user.mobile_number}. Creating new one.`,
        );

        const flowDeninition = await flowDefinitionModel.findOne({
            slug: DEFAULT_ONBOARDING_SLUG,
            status: "PUBLISHED",
        });

        if (!flowDeninition) {
            console.error(`Default flow "${DEFAULT_ONBOARDING_SLUG}" not found or not published.`);
            return;
        }

        const newConversation = await createNewFlowForUser(user, flowDeninition);

        // Send notification
        if (newConversation) {
            await sendPushNotification({
                token: user.FCM_token,
                title: "Time for your check-in!",
                body: "Let's get started with your first check-in.",
                data: {
                    conversationId: newConversation._id.toString(),
                    flowSlug: flowDeninition.slug,
                },
            });
        }
        return;
    }

    // If state is COMPLETED or ACTIVE, do nothing.
    if (
        lastInstance.state === FlowInstanceStateEnum.COMPLETED ||
        lastInstance.state === FlowInstanceStateEnum.ACTIVE
    ) {
        console.log(
            `User ${user.email ? user.email : user.mobile_number} state is ${lastInstance.state}. No action needed.`,
        );
        return;
    }

    // If state is REMIND_ME_LATER, check time if it is greadter than 30 minutes send another notification.
    if (lastInstance.state === FlowInstanceStateEnum.REMIND_ME_LATER) {
        console.log(
            `User ${user.email ? user.email : user.mobile_number} state is REMIND_ME_LATER. Checking time...`,
        );
        const conversation = await conversationModel.findById(lastInstance.conversationId);

        if (!conversation) {
            console.error(`Orphan flow instance ${lastInstance._id} found. No conversation.`);
            return;
        }

        const lastMessageTime = conversation.lastMessageAt.getTime();
        console.log("lastMessageTime is, ", lastMessageTime);
        const isOverdue = lastMessageTime < Date.now() - REMINDER_TIME_MS;

        if (isOverdue) {
            console.log(
                `User ${user.email ? user.email : user.mobile_number} is overdue. Sending reminder and creating new flow.`,
            );

            // Create a new flow instance by copying the old one, but setting state to ACTIVE
            const newInstanceData = {
                ...lastInstance.toObject(),
                _id: new mongoose.Types.ObjectId(),
                state: FlowInstanceStateEnum.ACTIVE,
                createdAt: new Date(),
                updatedAt: new Date(),
            };

            await flowInstanceModel.create(newInstanceData);

            // Send notification
            await sendPushNotification({
                token: user.FCM_token,
                title: "Your check-in is waiting",
                body: "Let's continue where you left off.",
                data: {
                    conversationId: lastInstance.conversationId.toString(),
                    flowSlug: lastInstance.flowSlug,
                    uiElements: JSON.stringify([
                        {
                            type: "BUTTON",
                            text: "Continue Check-in",
                            action: "CONTINUE_FLOW",
                        },
                    ]),
                },
            });
        } else {
            console.log(
                `User ${user.email ? user.email : user.mobile_number} is not overdue yet. No action.`,
            );
        }
    }
};

export const startOrContinueConversation = async () => {
    console.log("--- Running Start/Continue Conversation Job ---");

    // Get all users who have an FCM token
    const users = await UserModel.find({
        FCM_token: { $exists: true, $ne: null },
    });

    for (const user of users) {
        try {
            await processUser(user);
        } catch (error: any) {
            console.error(`Failed to process user ${user._id}:`, error.message);
        }
    }

    console.log("--- Start/Continue Conversation Job Finished ---");
};
