import flowResponseModel from "../models/flowResponse.model";

// Transform flow responses to indicators format
export async function transformFlowResponsesToIndicators(flowInstanceId: string): Promise<{
    physical: number[];
    lactation: number[];
    emotional: number[];
}> {
    // Get all responses for this flow instance
    const responses = await flowResponseModel
        .find({ flowInstanceId })
        .sort({ createdAt: 1 })
        .lean();

    console.log(`Found ${responses.length} responses for flow instance ${flowInstanceId}`);

    const indicators = {
        physical: [] as number[],
        lactation: [] as number[],
        emotional: [] as number[],
    };

    responses.forEach((response, index) => {
        // Extract the answer value correctly
        const selectedKeys = response.answer?.selectedKeys;

        if (!selectedKeys || selectedKeys.length === 0) {
            console.log(`Response ${index + 1} has no selectedKeys, skipping`);
            return;
        }

        // Get the first selected key and convert to number
        const answerValue = selectedKeys[0];
        if (answerValue === undefined || answerValue === null || isNaN(answerValue)) {
            console.log(`Response ${index + 1} has invalid value: ${selectedKeys[0]}, skipping`);
            return;
        }

        const nodeId = response.nodeId;
        console.log(`Processing response ${index + 1}: nodeId=${nodeId}, value=${answerValue}`);

        if (
            nodeId.includes("lochia") ||
            nodeId.includes("mobility") ||
            nodeId.includes("perineal") ||
            nodeId.includes("fever") ||
            nodeId.includes("constipation")
        ) {
            indicators.physical.push(answerValue);
        } else if (
            nodeId.includes("supplement_adherence") ||
            nodeId.includes("nutrition") ||
            nodeId.includes("supplements") ||
            nodeId.includes("lactation")
        ) {
            indicators.lactation.push(answerValue);
        } else if (
            nodeId.includes("mood") ||
            nodeId.includes("sleep") ||
            nodeId.includes("family")
        ) {
            indicators.emotional.push(answerValue);
        } else {
            console.log(`Unmatched nodeId: ${nodeId}, skipping`);
        }
    });

    return indicators;
}
