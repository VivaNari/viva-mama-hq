import {
  IChatMessage,
  IAiMessage,
  IOption,
  NodeType,
  InputMode,
} from "../types/chat.types";
import {
  CHILD_DOB_NODE_ID,
  DELIVERY_DATE_NODE_ID,
  DOB_NODE_ID,
  MAX_CHILD_AGE_YEARS,
  MEASUREMENT_NODE_BOUNDS,
  MIN_AGE_YEARS,
  NONE_OPTION_VALUES,
  STILL_BIRTH_NODE_ID,
} from "../constants/chat";

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
 * Check if message is the date-of-birth node
 */
export const isDobNode = (message: IChatMessage): boolean => {
  return isAiMessage(message) && message.id === DOB_NODE_ID;
};

/**
 * Check if message is the CHILD's date-of-birth node.
 *
 * Distinct from isDobNode: that one is the mother's, and the two need opposite date
 * bounds. Sharing them capped the child picker at 18 years ago, which made it impossible
 * to enter a real birth date for a newborn.
 */
export const isChildDobNode = (message: IChatMessage): boolean => {
  return isAiMessage(message) && message.id === CHILD_DOB_NODE_ID;
};

/**
 * Check if message is one of the baby birth-measurement nodes.
 */
export const isMeasurementNode = (message: IChatMessage): boolean => {
  return isAiMessage(message) && !!MEASUREMENT_NODE_BOUNDS[message.id];
};

/**
 * Date bounds for whichever date question is on screen.
 *
 * The mother must be at least MIN_AGE_YEARS old; a child must have been born already and
 * be under MAX_CHILD_AGE_YEARS, since growth tracking stops at five.
 */
export const getDateBoundsForNode = (
  message: IChatMessage | undefined,
): { minimumDate?: Date; maximumDate: Date } => {
  if (message && isChildDobNode(message)) {
    const earliest = new Date();
    earliest.setFullYear(earliest.getFullYear() - MAX_CHILD_AGE_YEARS);
    return { minimumDate: earliest, maximumDate: new Date() };
  }

  return { maximumDate: getMaxDateOfBirth() };
};

/**
 * Validate a typed birth measurement against the node's range.
 *
 * Returns null when the value is acceptable, otherwise a message to show the user. The
 * server drops out-of-range values silently, so catching them here is what turns a lost
 * answer into a correctable one.
 */
export const validateMeasurement = (
  message: IChatMessage | undefined,
  raw: string,
): string | null => {
  if (!message || !isAiMessage(message)) return null;

  const bounds = MEASUREMENT_NODE_BOUNDS[message.id];
  if (!bounds) return null;

  const value = Number.parseFloat(raw.trim());
  if (!Number.isFinite(value)) {
    return "Please enter a number.";
  }

  if (value < bounds.min || value > bounds.max) {
    return `Please enter a value between ${bounds.min} and ${bounds.max} ${bounds.unit}.`;
  }

  return null;
};

/**
 * Check if message is the special stillbirth support node (grief-sensitive
 * terminal message that offers expert/AI support buttons).
 */
export const isStillBirthNode = (message: IChatMessage): boolean => {
  return isAiMessage(message) && message.id === STILL_BIRTH_NODE_ID;
};

/**
 * Latest date of birth allowed for a user to be at least MIN_AGE_YEARS old today.
 */
export const getMaxDateOfBirth = (minAgeYears = MIN_AGE_YEARS): Date => {
  const date = new Date();
  date.setFullYear(date.getFullYear() - minAgeYears);
  return date;
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

  // Before the generic text branch: measurements are free-text nodes, so the plain
  // handler would claim them and hand the user an alphabetic keyboard.
  if (isMeasurementNode(lastMessage)) {
    return "number";
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
 * Extract scores from selected options.
 *
 * NOTE: a score is a clinical weight, NOT an identifier — several options in a
 * node routinely share one. Never use scores to tell the server which option was
 * picked; use `getSelectedValues` for that.
 */
export const getSelectedScores = (
  selectedIds: Set<string>,
  options: IOption[],
): number[] => {
  return getSelectedOptions(selectedIds, options).map(opt => opt.score);
};

/**
 * Extract the `value` tokens of the selected options — the identity the server
 * resolves answers by. Unique within a node, unlike `score`.
 */
export const getSelectedValues = (
  selectedIds: Set<string>,
  options: IOption[],
): string[] => {
  return getSelectedOptions(selectedIds, options).map(opt => opt.value);
};
