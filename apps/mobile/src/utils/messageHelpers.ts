import { TFunction } from "i18next";
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
 *
 * Takes `t` rather than returning a key, matching `getChildAgeLabel` and `formatChipDate`:
 * the caller renders this straight into the chat input, so handing it a key would only move
 * the same lookup one line away. The strings used to be English literals, which meant a
 * Hindi mother was asked the question in Hindi and corrected in English.
 */
export const validateMeasurement = (
  message: IChatMessage | undefined,
  raw: string,
  t: TFunction,
): string | null => {
  if (!message || !isAiMessage(message)) return null;

  const bounds = MEASUREMENT_NODE_BOUNDS[message.id];
  if (!bounds) return null;

  const value = Number.parseFloat(raw.trim());
  if (!Number.isFinite(value)) {
    return t("infant.editChild.notANumber");
  }

  if (value < bounds.min || value > bounds.max) {
    return t("chat.measurementOutOfRange", {
      min: bounds.min,
      max: bounds.max,
      unit: bounds.unit,
    });
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

// ---------------------------------------------------------------------------
// Voice: read-aloud and speech input
// ---------------------------------------------------------------------------

/** BCP-47 tags the voice features use. Indian English, not en-US, so names and
 *  units are pronounced the way she would say them. */
export type SpeechLang = 'hi-IN' | 'en-IN';

const DEVANAGARI_RE = /[ऀ-ॿ]/;

/**
 * Which voice should read this text. Decided from the text itself rather than the
 * app language: a reply may be in Hindi while the app is in English, or the reverse.
 */
export const detectSpeechLang = (text: string): SpeechLang =>
  DEVANAGARI_RE.test(text) ? 'hi-IN' : 'en-IN';

// Common Hindi words that are not also English words. "main", "to", "din" and "agar"
// are left out on purpose: each reads as ordinary English in a health answer.
const HINGLISH_MARKERS = new Set([
  'aap', 'aapka', 'aapke', 'aapki', 'aapko', 'aapne', 'abhi', 'apna', 'apne', 'apni',
  'aur', 'bahut', 'chahiye', 'haan', 'hai', 'hain', 'hoga', 'hogi', 'hota', 'hoti',
  'hote', 'jaise', 'kaise', 'kar', 'kare', 'karein', 'karen', 'karna', 'karte', 'karti',
  'kya', 'kyun', 'kyunki', 'lekin', 'liye', 'mein', 'mujhe', 'nahi', 'nahin', 'raha',
  'rahe', 'rahi', 'sakta', 'sakte', 'sakti', 'theek', 'thoda', 'toh', 'yeh', 'zaroor',
]);

/**
 * Whether a reply is Hindi written in English letters. Two different markers, so that
 * one name or borrowed word in an English reply doesn't send it for conversion.
 */
export const isLikelyHinglish = (text: string): boolean => {
  if (DEVANAGARI_RE.test(text)) return false;
  const words = text.toLowerCase().match(/[a-z]+/g) ?? [];
  const found = new Set(words.filter((word) => HINGLISH_MARKERS.has(word)));
  return found.size >= 2;
};

/** The language the mic listens in: the app's language, as the replies are. */
export const speechLangForAppLanguage = (appLanguage: string | undefined): SpeechLang =>
  appLanguage?.startsWith('hi') ? 'hi-IN' : 'en-IN';

// Pictographs, dingbats, variation selectors and joiners. A voice reads an emoji's
// name aloud ("smiling face with heart eyes"), which is noise in a health answer.
// Explicit ranges rather than \p{Extended_Pictographic}, which not every Hermes build
// accepts.
const EMOJI_RE =
  /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{1F1E6}-\u{1F1FF}\u{FE0F}\u{200D}\u{20E3}]/gu;

/**
 * Turn a Markdown reply into text a voice can read: without this the speech engine
 * says "asterisk asterisk" for bold and reads URLs out character by character.
 * Mirrors what MarkdownText renders, so she hears what she sees.
 */
export const toSpeakableText = (markdown: string): string =>
  markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/^\s*>\s?/gm, '')
    .replace(/^\s*(?:[*+-]|\d+[.)])\s+/gm, '')
    .replace(/(\*\*|__)(.+?)\1/g, '$2')
    .replace(/(\*|_)(\S(?:.*?\S)?)\1/g, '$2')
    .replace(EMOJI_RE, '')
    // A line break is a pause; end the line as a sentence if it doesn't already.
    .replace(/([^.!?।:;,\s])\s*\n+/g, '$1. ')
    .replace(/\s*\n+\s*/g, ' ')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();

/**
 * Split long text into sentence-sized pieces no longer than `maxLength`.
 * Speech engines cap a single utterance (Android at ~4000 chars); splitting on
 * sentence ends (including the Hindi danda, ।) keeps the pauses natural.
 */
export const chunkForSpeech = (text: string, maxLength: number): string[] => {
  if (text.length <= maxLength) return text ? [text] : [];
  const sentences = text.match(/[^.!?।]+[.!?।]*\s*/g) ?? [text];
  const chunks: string[] = [];
  let current = '';
  for (const sentence of sentences) {
    if ((current + sentence).length > maxLength && current) {
      chunks.push(current.trim());
      current = '';
    }
    if (sentence.length > maxLength) {
      // One enormous "sentence": fall back to hard slices.
      for (let i = 0; i < sentence.length; i += maxLength) {
        chunks.push(sentence.slice(i, i + maxLength).trim());
      }
      continue;
    }
    current += sentence;
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks.filter(Boolean);
};
