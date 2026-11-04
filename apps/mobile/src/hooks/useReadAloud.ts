import { useCallback, useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import { useTranslation } from "react-i18next";
import Toast from "react-native-toast-message";
import * as Speech from "expo-speech";

import { AnalyticsEvent, track } from "../analytics";
import { getSpeechText } from "../api/speechText.api";
import {
  SpeechLang,
  chunkForSpeech,
  detectSpeechLang,
  isLikelyHinglish,
  toSpeakableText,
} from "../utils/messageHelpers";

/** Below the smallest engine limit we know of, in case the reported one is wrong. */
const FALLBACK_MAX_LENGTH = 3900;
/** Enough for a long chat; the oldest conversion is dropped after this. */
const MAX_CACHED_REPLIES = 50;

/**
 * Reads Viva's replies aloud with the phone's own speech engine (expo-speech).
 *
 * One reply plays at a time: tapping another reply's speaker, or the same one again,
 * stops what is playing. The voice is chosen from the reply itself, so a Hindi reply is
 * read in a Hindi voice even when the app is in English. A reply in Hinglish is first
 * converted to Devanagari by the server, because phone voices can't pronounce Hindi
 * written in English letters; the chat keeps showing the original.
 */
export function useReadAloud() {
  const { t } = useTranslation();
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  // Tapped or automatic, but no sound yet: converting Hinglish or waiting for the engine.
  const [preparingId, setPreparingId] = useState<string | null>(null);
  // Every play gets a new session number. Callbacks from a session that has since
  // been stopped or replaced check it and do nothing, so a late onDone from the old
  // reply can't clear the icon of the new one.
  const sessionRef = useRef(0);
  const voicesRef = useRef<Speech.Voice[] | null>(null);
  const devanagariCacheRef = useRef(new Map<string, string>());

  const stop = useCallback(() => {
    sessionRef.current += 1;
    setSpeakingId(null);
    setPreparingId(null);
    Speech.stop().catch(() => undefined);
  }, []);

  // Never keep talking after she leaves the chat.
  useEffect(() => stop, [stop]);

  /**
   * Whether the phone has a voice for this language. An empty list means the engine
   * hasn't reported yet (common on Android's first call), not that nothing is
   * installed, so we let the engine try rather than block her.
   */
  const hasVoiceFor = useCallback(async (lang: SpeechLang): Promise<boolean> => {
    if (!voicesRef.current?.length) {
      try {
        voicesRef.current = await Speech.getAvailableVoicesAsync();
      } catch {
        voicesRef.current = [];
      }
    }
    const voices = voicesRef.current;
    if (!voices.length) return true;
    const prefix = lang.slice(0, 2).toLowerCase();
    return voices.some((v) => v.language?.toLowerCase().replace("_", "-").startsWith(prefix));
  }, []);

  /** The Devanagari copy of a Hinglish reply, fetched once per reply. */
  const devanagariFor = useCallback(async (text: string): Promise<string> => {
    const cached = devanagariCacheRef.current.get(text);
    if (cached) return cached;
    const converted = await getSpeechText(text);
    if (!detectSpeechLang(converted).startsWith("hi")) throw new Error("not Devanagari");
    const cache = devanagariCacheRef.current;
    if (cache.size >= MAX_CACHED_REPLIES) cache.delete(cache.keys().next().value as string);
    cache.set(text, converted);
    return converted;
  }, []);

  const play = useCallback(
    async (id: string, text: string) => {
      stop();
      const session = sessionRef.current;
      let spoken = toSpeakableText(text);
      if (!spoken) return;

      const hinglish = isLikelyHinglish(spoken);
      const language: SpeechLang = hinglish ? "hi-IN" : detectSpeechLang(spoken);
      if (!(await hasVoiceFor(language))) {
        Toast.show({ type: "info", text1: t("chat.voice.unavailable"), position: "bottom" });
        return;
      }
      if (session !== sessionRef.current) return; // she tapped something else meanwhile

      if (hinglish) {
        setPreparingId(id);
        try {
          spoken = await devanagariFor(spoken);
        } catch {
          // Not the English voice instead: that is the accent this exists to avoid.
          if (session === sessionRef.current) {
            setPreparingId(null);
            Toast.show({ type: "error", text1: t("chat.voice.speakFailed"), position: "bottom" });
          }
          return;
        }
        if (session !== sessionRef.current) return;
      }

      const max = Speech.maxSpeechInputLength > 0 ? Speech.maxSpeechInputLength : FALLBACK_MAX_LENGTH;
      const chunks = chunkForSpeech(spoken, Math.min(max, FALLBACK_MAX_LENGTH));
      // "Speaking" means sound is coming out, not that the engine was asked: it can take
      // a while to start, or fail, when the voice has to come over the network.
      setPreparingId(id);
      track(AnalyticsEvent.CHAT_READ_ALOUD_PLAYED, { lang: language });

      const started = () => {
        if (session !== sessionRef.current) return;
        setPreparingId(null);
        setSpeakingId(id);
      };
      const finish = () => {
        if (session !== sessionRef.current) return;
        setPreparingId(null);
        setSpeakingId(null);
      };

      chunks.forEach((chunk, index) => {
        const isLast = index === chunks.length - 1;
        Speech.speak(chunk, {
          language,
          // iOS: speak through the synthesizer's own audio session. The app session
          // may still be in the mic's record mode, which plays speech quietly
          // through the earpiece.
          useApplicationAudioSession: Platform.OS === "ios" ? false : undefined,
          onStart: started,
          onDone: isLast ? finish : undefined,
          onStopped: finish,
          onError: () => {
            if (session !== sessionRef.current) return;
            Toast.show({ type: "error", text1: t("chat.voice.speakFailed"), position: "bottom" });
            stop();
          },
        });
      });
    },
    [devanagariFor, hasVoiceFor, stop, t],
  );

  /** Play this reply, or stop it if it is the one playing or getting ready. */
  const toggle = useCallback(
    (id: string, text: string) => {
      if (speakingId === id || preparingId === id) {
        stop();
        return;
      }
      play(id, text);
    },
    [play, preparingId, speakingId, stop],
  );

  return { speakingId, preparingId, toggle, stop };
}
