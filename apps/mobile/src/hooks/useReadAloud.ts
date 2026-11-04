import { useCallback, useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import { useTranslation } from "react-i18next";
import Toast from "react-native-toast-message";
import * as Speech from "expo-speech";

import { AnalyticsEvent, track } from "../analytics";
import {
  SpeechLang,
  chunkForSpeech,
  detectSpeechLang,
  toSpeakableText,
} from "../utils/messageHelpers";

/** Below the smallest engine limit we know of, in case the reported one is wrong. */
const FALLBACK_MAX_LENGTH = 3900;

/**
 * Reads Viva's replies aloud with the phone's own speech engine (expo-speech).
 *
 * One reply plays at a time: tapping another reply's speaker, or the same one again,
 * stops what is playing. The voice is chosen from the reply's own script, so a Hindi
 * reply is read in a Hindi voice even when the app is in English.
 */
export function useReadAloud() {
  const { t } = useTranslation();
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  // Every play gets a new session number. Callbacks from a session that has since
  // been stopped or replaced check it and do nothing, so a late onDone from the old
  // reply can't clear the icon of the new one.
  const sessionRef = useRef(0);
  const voicesRef = useRef<Speech.Voice[] | null>(null);

  const stop = useCallback(() => {
    sessionRef.current += 1;
    setSpeakingId(null);
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

  const play = useCallback(
    async (id: string, text: string) => {
      stop();
      const session = sessionRef.current;
      const spoken = toSpeakableText(text);
      if (!spoken) return;

      const language = detectSpeechLang(spoken);
      if (!(await hasVoiceFor(language))) {
        Toast.show({ type: "info", text1: t("chat.voice.unavailable"), position: "bottom" });
        return;
      }
      if (session !== sessionRef.current) return; // she tapped something else meanwhile

      const max = Speech.maxSpeechInputLength > 0 ? Speech.maxSpeechInputLength : FALLBACK_MAX_LENGTH;
      const chunks = chunkForSpeech(spoken, Math.min(max, FALLBACK_MAX_LENGTH));
      setSpeakingId(id);
      track(AnalyticsEvent.CHAT_READ_ALOUD_PLAYED, { lang: language });

      const finish = () => {
        if (session === sessionRef.current) setSpeakingId(null);
      };

      chunks.forEach((chunk, index) => {
        const isLast = index === chunks.length - 1;
        Speech.speak(chunk, {
          language,
          // iOS: speak through the synthesizer's own audio session. The app session
          // may still be in the mic's record mode, which plays speech quietly
          // through the earpiece.
          useApplicationAudioSession: Platform.OS === "ios" ? false : undefined,
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
    [hasVoiceFor, stop, t],
  );

  /** Play this reply, or stop it if it is the one playing. */
  const toggle = useCallback(
    (id: string, text: string) => {
      if (speakingId === id) {
        stop();
        return;
      }
      play(id, text);
    },
    [play, speakingId, stop],
  );

  return { speakingId, toggle, stop };
}
