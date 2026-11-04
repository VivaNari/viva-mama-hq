import { useCallback, useEffect, useRef, useState } from "react";

import { ChatEntry, InputMode } from "../types/chat.types";

interface Options {
  /** How she arrived: tapped the hub's text box, or its mic. */
  entry: ChatEntry | undefined;
  inputMode: InputMode;
  isAnimating: boolean;
  /** She has questions left. Without any, the mic stays closed. */
  canAsk: boolean;
  skipAnimation: () => void;
  startListening: () => void;
}

/**
 * Carries out what she asked for on the Viva AI hub once chat can take a message.
 *
 * The input bar stays hidden until the welcome message has finished typing, which would
 * leave her waiting several seconds after tapping "ask". So she gets the welcome message
 * whole. Runs once per visit: leaving cancels it, so the mic never opens on a screen she
 * has left, or again when she comes back.
 */
export function useChatEntry({
  entry,
  inputMode,
  isAnimating,
  canAsk,
  skipAnimation,
  startListening,
}: Options) {
  const pendingRef = useRef(entry);
  const [autoFocus, setAutoFocus] = useState(entry === "type");
  const latestRef = useRef({ canAsk, skipAnimation, startListening });
  latestRef.current = { canAsk, skipAnimation, startListening };

  useEffect(() => {
    const pending = pendingRef.current;
    if (!pending) return;
    if (isAnimating) {
      latestRef.current.skipAnimation();
      return;
    }
    if (inputMode !== "text") return;
    pendingRef.current = undefined;
    if (pending === "voice" && latestRef.current.canAsk) latestRef.current.startListening();
  }, [inputMode, isAnimating]);

  /** She sent something or left: stop acting on how she arrived. */
  const cancel = useCallback(() => {
    pendingRef.current = undefined;
    setAutoFocus(false);
  }, []);

  return { autoFocus, cancel };
}
