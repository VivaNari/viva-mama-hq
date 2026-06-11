import mongoose from "mongoose";
import flowResponseModel from "../models/flowResponse.model";

interface QuestionAnswer {
    question: string;
    answer: string;
}

export async function getFlowQuestionsAndAnswers(
    flowInstanceId: string,
): Promise<QuestionAnswer[]> {
    try {
        const result = await flowResponseModel.aggregate([
            // Stage 1: Match all responses for this flow instance
            {
                $match: {
                    flowInstanceId: new mongoose.Types.ObjectId(flowInstanceId),
                },
            },

            // Stage 2: Sort by creation time to maintain order
            {
                $sort: { createdAt: 1 },
            },

            // Stage 3: Lookup the flow definition
            {
                $lookup: {
                    from: "flow_definitions", // Change this to your actual collection name
                    localField: "flowDefId",
                    foreignField: "_id",
                    as: "flowDefinition",
                },
            },

            // Stage 4: Unwind the flowDefinition array (since lookup returns array)
            {
                $unwind: {
                    path: "$flowDefinition",
                    preserveNullAndEmptyArrays: false,
                },
            },

            // Stage 5: Add fields to extract question and answer
            {
                $addFields: {
                    // Find the matching node from the nodes array
                    matchingNode: {
                        $arrayElemAt: [
                            {
                                $filter: {
                                    input: "$flowDefinition.nodes",
                                    as: "node",
                                    cond: { $eq: ["$$node.id", "$nodeId"] },
                                },
                            },
                            0,
                        ],
                    },
                },
            },

            // Stage 6: Add fields to get the selected option label
            {
                $addFields: {
                    selectedScore: { $arrayElemAt: ["$answer.selectedKeys", 0] },
                },
            },

            // Stage 7: Add field to find matching option
            {
                $addFields: {
                    matchingOption: {
                        $arrayElemAt: [
                            {
                                $filter: {
                                    input: "$matchingNode.options",
                                    as: "option",
                                    cond: { $eq: ["$$option.score", "$selectedScore"] },
                                },
                            },
                            0,
                        ],
                    },
                },
            },

            // Stage 8: Project only the fields we need
            {
                $project: {
                    _id: 0,
                    question: "$matchingNode.text",
                    answer: {
                        $cond: {
                            if: { $ifNull: ["$answer.freeText", false] },
                            then: "$answer.freeText",
                            else: "$matchingOption.label",
                        },
                    },
                },
            },

            // Stage 9: Filter out any null questions (in case of data issues)
            {
                $match: {
                    question: { $ne: null },
                    answer: { $ne: null },
                },
            },
        ]);

        console.log(
            `✅ Found ${result.length} question-answer pairs for flow instance ${flowInstanceId}`,
        );

        return result;
    } catch (error) {
        console.error("❌ Error in getFlowQuestionsAndAnswers:", error);
        throw error;
    }
}
