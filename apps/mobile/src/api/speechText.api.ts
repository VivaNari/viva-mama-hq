import { CHAT_SPEECH_TEXT } from "../constants/endpoints";
import apiClientInterceptor from "./apiClientInterceptor";

/** Longer than the server's own limit, so its answer or error arrives first. */
const SPEECH_TEXT_TIMEOUT_MS = 40_000;

/** A Devanagari copy of a Hinglish reply, for the phone's Hindi voice. */
export const getSpeechText = async (text: string): Promise<string> => {
  const { data } = await apiClientInterceptor().post(
    CHAT_SPEECH_TEXT,
    { text },
    { timeout: SPEECH_TEXT_TIMEOUT_MS },
  );
  return data.data.text;
};
