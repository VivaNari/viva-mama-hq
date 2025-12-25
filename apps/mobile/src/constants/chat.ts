import { FlowTypeEnum } from "../types/vivaAi.types";

export const flowSlugMapping = {
    [FlowTypeEnum.ONBOARDING]: 'onboarding-flow-v2',
    [FlowTypeEnum.CHECKIN]: 'weekly-checkin-v1',
    [FlowTypeEnum.CHATBOT]: "chatbot-flow",
}

export const messageEventTypes = {
    AI_MESSAGE: 'ai_message',
    USER_MESSAGE: 'user_message',
    END_FLOW: 'end_flow',
    ERROR: 'error',
};

export const NAME_QUERY = "Please provide a valid name so that we can proceed.";
