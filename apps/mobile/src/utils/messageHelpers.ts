import {
  IChatMessage,
  IAiMessage,
  IOption,
  NodeType,
  InputMode,
} from "../types/chat.types";
import { DELIVERY_DATE_NODE_ID, NONE_OPTION_VALUES } from "../constants/chat";

/**
 * Type guard to check if a message is an AI message
 */
export const isAiMessage = (message: IChatMessage): message is IAiMessage => {
  return message.type === "ai";
};

export const isChatbotMessage = (message: IChatMessage): boolean => {
  return message.type === "ai" && message.flowInstanceId === "chatbot";
};

/**
 * Check if message expects text input
 */
export const isTextInputMessage = (message: IChatMessage): boolean => {
  return (
    isAiMessage(message) && message.nodeType === NodeType.QUESTION_FREE_TEXT
  );
};

/**
 * Check if message expects date input
 */
export const isDateInputMessage = (message: IAiMessage): boolean => {
  return isAiMessage(message) && message.nodeType === NodeType.QUESTION_DATE;
};

export const hasOptions = (message: IAiMessage): boolean => {
  return !!message.options && message.options.length > 0;
};

/**
 * Check if message expects multi-select input
 */
export const isMultiSelectMessage = (message: IChatMessage): boolean => {
  return isAiMessage(message) && message.nodeType === NodeType.QUESTION_MULTI;
};

/**
 * Check if message is the special delivery date node
 */
export const isDeliveryDateNode = (message: IChatMessage): boolean => {
  return isAiMessage(message) && message.id === DELIVERY_DATE_NODE_ID;
};

/**
 * Determine the input mode based on the last message
 */
export const determineInputMode = (
  lastMessage: IChatMessage | undefined,
  isLoading: boolean,
  isAnimating: boolean,
): InputMode => {
  if (!lastMessage || isLoading || isAnimating) {
    return "none";
  }

  if (!isAiMessage(lastMessage)) {
    return "none";
  }

  if (isDeliveryDateNode(lastMessage)) {
    return "deliveryDate";
  }

  if (
    isTextInputMessage(lastMessage) &&
    !hasOptions(lastMessage) &&
    !isDateInputMessage(lastMessage)
  ) {
    return "text";
  }

  if (isDateInputMessage(lastMessage)) {
    return "date";
  }

  if (isMultiSelectMessage(lastMessage)) {
    return "multiSelect";
  }

  return "none";
};

/**
 * Check if an option is a "none" type option
 */
export const isNoneOption = (option: IOption): boolean => {
  return NONE_OPTION_VALUES.includes(
    option.value as (typeof NONE_OPTION_VALUES)[number],
  );
};

/**
 * Handle multi-option toggle logic
 * Returns the new set of selected options
 */
export const toggleMultiOption = (
  currentSelected: Set<string>,
  option: IOption,
  allOptions: IOption[],
): Set<string> => {
  const newSet = new Set(currentSelected);
  const isNone = isNoneOption(option);

  // Find the none option in current selections
  const noneOption = allOptions.find(opt => isNoneOption(opt));

  if (isNone) {
    if (newSet.has(option.id)) {
      // Deselect none option
      newSet.delete(option.id);
    } else {
      // Select none option, clear all others
      newSet.clear();
      newSet.add(option.id);
    }
  } else {
    // If clicking any other option, remove "None" if selected
    if (noneOption && newSet.has(noneOption.id)) {
      newSet.delete(noneOption.id);
    }

    // Toggle the current option
    if (newSet.has(option.id)) {
      newSet.delete(option.id);
    } else {
      newSet.add(option.id);
    }
  }

  return newSet;
};

/**
 * Format date for API submission
 */
export const formatDateForApi = (date: Date): string => {
  return date.toISOString().split("T")[0];
};

/**
 * Get selected options from a set of IDs
 */
export const getSelectedOptions = (
  selectedIds: Set<string>,
  options: IOption[],
): IOption[] => {
  return options.filter(opt => selectedIds.has(opt.id));
};

/**
 * Extract labels from selected options
 */
export const getSelectedLabels = (
  selectedIds: Set<string>,
  options: IOption[],
): string => {
  return getSelectedOptions(selectedIds, options)
    .map(opt => opt.label)
    .join(", ");
};

/**
 * Extract scores from selected options
 */
export const getSelectedScores = (
  selectedIds: Set<string>,
  options: IOption[],
): number[] => {
  return getSelectedOptions(selectedIds, options).map(opt => opt.score);
};
