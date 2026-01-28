import {
    AI_FLOW_GREETING_MESSAGE_PREDICATE,
    AI_FLOW_GREETING_MESSAGE_SUBJECT,
} from "../../constants/uiConstants";

export const getAIGreetingMessage = (userName: string): string => {
    return AI_FLOW_GREETING_MESSAGE_SUBJECT + userName + ". " + AI_FLOW_GREETING_MESSAGE_PREDICATE;
};
