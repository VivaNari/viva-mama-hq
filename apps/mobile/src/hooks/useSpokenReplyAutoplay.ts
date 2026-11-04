import { useCallback, useEffect, useRef } from "react";

import { IChatMessage } from "../types/chat.types";
import { isAiMessage } from "../utils/messageHelpers";

interface Options {
  inputText: string;
  lastMessage: IChatMessage | undefined;
  play: (id: string, text: string) => void;
}

/**
 * Reads Viva's reply aloud on its own when she asked the question by voice: someone
 * talking to the app may not be looking at it. A question she only typed stays silent.
 *
 * Words the mic put in the box still count as spoken if she then corrects them by hand.
 */
export function useSpokenReplyAutoplay({ inputText, lastMessage, play }: Options) {
  const spokenRef = useRef(false);
  // The last message when she sent a spoken question; the next AI message after it is
  // the reply. Null when no reply should play.
  const awaitingRef = useRef<{ afterId: string | undefined } | null>(null);
  const lastIdRef = useRef(lastMessage?.id);
  lastIdRef.current = lastMessage?.id;
  const playRef = useRef(play);
  playRef.current = play;

  // She emptied the box, so whatever she types next wasn't spoken.
  useEffect(() => {
    if (!inputText.trim()) spokenRef.current = false;
  }, [inputText]);

  useEffect(() => {
    const awaiting = awaitingRef.current;
    if (!awaiting || !lastMessage || !isAiMessage(lastMessage)) return;
    if (lastMessage.id === awaiting.afterId) return;
    awaitingRef.current = null;
    playRef.current(lastMessage.id, lastMessage.text);
  }, [lastMessage]);

  /** The mic put words in the box. */
  const markSpoken = useCallback(() => {
    spokenRef.current = true;
  }, []);

  /** She sent what is in the box. */
  const noteSent = useCallback(() => {
    awaitingRef.current = spokenRef.current ? { afterId: lastIdRef.current } : null;
    spokenRef.current = false;
  }, []);

  /** She left, or opened the mic again: Viva must not start talking over that. */
  const cancel = useCallback(() => {
    awaitingRef.current = null;
  }, []);

  return { markSpoken, noteSent, cancel };
}
