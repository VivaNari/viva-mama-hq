import {
    AI_FLOW_GREETING_MESSAGE_PREDICATE,
    AI_FLOW_GREETING_MESSAGE_PREDICATE_HI,
    AI_FLOW_GREETING_MESSAGE_SUBJECT,
    AI_FLOW_GREETING_MESSAGE_SUBJECT_HI,
} from "../../constants/uiConstants";
import { DEFAULT_FLOW_LANGUAGE, FlowLanguage, FlowLanguageEnum } from "../../types/chat.types";

export const getAIGreetingMessage = (
    userName: string,
    lang: FlowLanguage = DEFAULT_FLOW_LANGUAGE,
): string => {
    if (lang === FlowLanguageEnum.HI) {
        return (
            AI_FLOW_GREETING_MESSAGE_SUBJECT_HI +
            userName +
            ", " +
            AI_FLOW_GREETING_MESSAGE_PREDICATE_HI
        );
    }
    return AI_FLOW_GREETING_MESSAGE_SUBJECT + userName + ". " + AI_FLOW_GREETING_MESSAGE_PREDICATE;
};
