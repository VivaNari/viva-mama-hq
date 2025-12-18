import { IUser } from "../../types/user.types";
import {
    FlowInstanceStateEnum,
    IConversation,
    IFlowDefinition,
    IFlowInstance,
} from "../../types/chat.types";
import conversationModel from "../../models/conversation.model";
import flowInstanceModel from "../../models/flowInstance.model";
import BaseService from "../base.service";

export class FlowInstanceService extends BaseService<IFlowInstance> {
    constructor() {
        super(flowInstanceModel);
    }

    async createNewFlowForUser(
        user: IUser,
        flowDef: IFlowDefinition,
    ): Promise<IConversation | null> {
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
                postpartumWeek: user.current_weekdays.weeks,
                postpartumDays: user.current_weekdays.days,
                cursorNodeId: flowDef.startNodeId,
                variables: {},
                outcome: null,
            });

            return newConversation;
        } catch (error) {
            console.error(`Error creating new flow for user ${user._id}:`, error);
            return null;
        }
    }

    createFlowInstance = async (payload: Partial<IFlowInstance>): Promise<IFlowInstance> => {
        return await flowInstanceModel.create(payload);
    };
}
