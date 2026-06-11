import { IUser } from "../../types/user.types";
import {
    FlowInstanceStateEnum,
    IConversation,
    IFlowDefinition,
    IFlowInstance,
    IFlowNode,
    NodeEligibilityResult,
} from "../../types/chat.types";
import conversationModel from "../../models/conversation.model";
import flowInstanceModel from "../../models/flowInstance.model";
import BaseService from "../base.service";
import {
    BREASTFEEDING_DEPENDENT_INDICATORS,
    ELIMINATION_INDICATORS,
    WEEKLY_CHECKIN_SLUG,
} from "../../constants/chat";
import flowDefinitionModel from "../../models/flowDefinition.model";
import flowResponseModel from "../../models/flowResponse.model";
import logger from "../../utils/logger";

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

    async getFlowDefinition(slug: string = WEEKLY_CHECKIN_SLUG): Promise<IFlowDefinition | null> {
        return flowDefinitionModel.findOne({
            slug,
            status: "PUBLISHED",
        });
    }

    /**
     * Get flow definition by ID
     */
    async getFlowDefinitionById(flowDefId: string): Promise<IFlowDefinition | null> {
        return flowDefinitionModel.findById(flowDefId);
    }

    /**
     * Get node from flow definition
     */
    getNode(flowDefinition: IFlowDefinition, nodeId: string): IFlowNode | undefined {
        return flowDefinition.nodes.find((n) => n.id === nodeId);
    }

    // ============================================
    // Node Eligibility Checks
    // ============================================

    /**
     * Check if node is active for the given week
     */
    isNodeActiveForWeek(node: IFlowNode, week: number): NodeEligibilityResult {
        // If no week constraints, always active
        if (node.validWeekStart === null && node.validWeekEnd === null) {
            return { isEligible: true };
        }

        const weekStart = node.validWeekStart ?? 1;
        const weekEnd = node.validWeekEnd ?? 52;

        const isEligible = week >= weekStart && week <= weekEnd;

        return {
            isEligible,
            reason: isEligible
                ? undefined
                : `Node not active for week ${week} (valid: ${weekStart}-${weekEnd})`,
        };
    }

    /**
     * Check if node is valid based on breastfeeding status
     */
    isNodeValidForBreastfeeding(node: IFlowNode, isBreastfeeding: boolean): NodeEligibilityResult {
        if (!BREASTFEEDING_DEPENDENT_INDICATORS.includes(node.indicator)) {
            return { isEligible: true };
        }

        return {
            isEligible: isBreastfeeding,
            reason: isBreastfeeding
                ? undefined
                : `Node requires breastfeeding (indicator: ${node.indicator})`,
        };
    }

    /**
     * Check if node should be eliminated (scored 2 for 2 consecutive weeks)
     */
    async isNodeEliminated(
        node: IFlowNode,
        userId: string,
        flowInstance: IFlowInstance,
    ): Promise<NodeEligibilityResult> {
        // Only elimination indicators can be eliminated
        if (!ELIMINATION_INDICATORS.includes(node.indicator)) {
            return { isEligible: true };
        }

        // Get last 2 completed instances
        const previousInstances = await flowInstanceModel
            .find({
                userId,
                flowDefId: flowInstance.flowDefId,
                state: FlowInstanceStateEnum.COMPLETED,
                _id: { $ne: flowInstance._id },
            })
            .sort({ createdAt: -1 })
            .limit(2)
            .lean();

        // Need at least 2 previous instances to check elimination
        if (previousInstances.length < 2) {
            return { isEligible: true };
        }

        // Get scores from previous instances
        const scores = await Promise.all(
            previousInstances.map(async (instance) => {
                const response = await flowResponseModel.findOne({
                    flowInstanceId: instance._id,
                    nodeId: node.id,
                });

                if (!response?.answer?.selectedKeys?.length) {
                    return null;
                }

                return response.answer.selectedKeys[0];
            }),
        );

        // Check if all scores are 2
        const allScoresAreTwo = scores.every((score) => score === 2);

        if (allScoresAreTwo) {
            logger.info(
                { nodeId: node.id, indicator: node.indicator, userId },
                "Node eliminated - scored 2 for 2 consecutive weeks",
            );
        }

        return {
            isEligible: !allScoresAreTwo,
            reason: allScoresAreTwo
                ? `Node eliminated - scored 2 for 2 weeks (indicator: ${node.indicator})`
                : undefined,
        };
    }

    /**
     * Comprehensive node eligibility check
     */
    async checkNodeEligibility(
        node: IFlowNode,
        user: IUser,
        flowInstance: IFlowInstance,
        week: number,
    ): Promise<NodeEligibilityResult> {
        // 1. Check week validity
        const weekResult = this.isNodeActiveForWeek(node, week);
        if (!weekResult.isEligible) {
            return weekResult;
        }

        // 2. Check breastfeeding dependency
        const breastfeedingResult = this.isNodeValidForBreastfeeding(
            node,
            user.is_breastfeeding_currently ?? true,
        );
        if (!breastfeedingResult.isEligible) {
            return breastfeedingResult;
        }

        // 3. Check elimination
        const eliminationResult = await this.isNodeEliminated(
            node,
            user._id.toString(),
            flowInstance,
        );
        if (!eliminationResult.isEligible) {
            return eliminationResult;
        }

        return { isEligible: true };
    }

    // ============================================
    // Flow Navigation
    // ============================================

    /**
     * Find next valid node, skipping ineligible ones
     */
    async findNextValidNode(
        user: IUser,
        flowInstance: IFlowInstance,
        flowDefinition: IFlowDefinition,
        startingNodeId: string | null,
        week: number,
    ): Promise<string | null> {
        let currentNodeId = startingNodeId;

        while (currentNodeId) {
            const node = this.getNode(flowDefinition, currentNodeId);

            if (!node) {
                logger.warn({ nodeId: currentNodeId }, "Node not found in flow definition");
                return null;
            }

            // Check eligibility
            const eligibility = await this.checkNodeEligibility(node, user, flowInstance, week);

            if (eligibility.isEligible) {
                logger.debug({ nodeId: node.id, week }, "Found valid node");
                return currentNodeId;
            }

            logger.debug(
                { nodeId: node.id, reason: eligibility.reason },
                "Skipping ineligible node",
            );

            // Move to next node
            currentNodeId = node.next;
        }

        logger.debug({ userId: user._id, week }, "No more valid nodes - flow complete");
        return null;
    }

    /**
     * Update cursor to next valid node
     * Returns the new cursor position or null if flow is complete
     */
    async moveToNextNode(
        user: IUser,
        flowInstance: IFlowInstance,
        flowDefinition: IFlowDefinition,
        currentNodeId: string,
        week: number,
    ): Promise<string | null> {
        const currentNode = this.getNode(flowDefinition, currentNodeId);

        if (!currentNode) {
            return null;
        }

        // Find next valid node starting from current node's next
        const nextNodeId = await this.findNextValidNode(
            user,
            flowInstance,
            flowDefinition,
            currentNode.next,
            week,
        );

        if (nextNodeId) {
            // Update cursor
            flowInstance.cursorNodeId = nextNodeId;
            await (flowInstance as any).save();

            logger.debug(
                { userId: user._id, from: currentNodeId, to: nextNodeId },
                "Moved cursor to next node",
            );
        }

        return nextNodeId;
    }

    /**
     * Check if flow has more questions
     */
    async hasMoreQuestions(
        user: IUser,
        flowInstance: IFlowInstance,
        flowDefinition: IFlowDefinition,
        week: number,
    ): Promise<boolean> {
        if (!flowInstance.cursorNodeId) {
            return false;
        }

        const nextNode = await this.findNextValidNode(
            user,
            flowInstance,
            flowDefinition,
            flowInstance.cursorNodeId,
            week,
        );

        return nextNode !== null;
    }

    // ============================================
    // Flow Instance Queries
    // ============================================

    /**
     * Check if check-in exists for week
     */
    async hasCheckinForWeek(userId: string, week: number): Promise<boolean> {
        const flowDefinition = await this.getFlowDefinition();
        if (!flowDefinition) return false;

        const existingInstance = await flowInstanceModel.findOne({
            userId,
            flowDefId: flowDefinition._id,
            postpartumWeek: week,
        });

        return !!existingInstance;
    }

    /**
     * Get flow instance by ID
     */
    async getFlowInstance(flowInstanceId: string): Promise<IFlowInstance | null> {
        return flowInstanceModel.findById(flowInstanceId);
    }

    /**
     * Get active flow instance for user and week
     */
    async getActiveFlowInstance(userId: string, week: number): Promise<IFlowInstance | null> {
        const flowDefinition = await this.getFlowDefinition();
        if (!flowDefinition) return null;

        return flowInstanceModel.findOne({
            userId,
            flowDefId: flowDefinition._id,
            postpartumWeek: week,
            state: FlowInstanceStateEnum.ACTIVE,
        });
    }
}
