import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Linking, Platform } from "react-native";
import { useTranslation } from "react-i18next";
import Toast from "react-native-toast-message";
import {
  ExpoSpeechRecognitionErrorCode,
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from "expo-speech-recognition";

import { AnalyticsEvent, track } from "../analytics";
import { SpeechLang } from "../utils/messageHelpers";

/** Google's recognizer: the engine behind Gboard voice typing. */
const GOOGLE_RECOGNIZER = "com.google.android.googlequicksearchbox";

interface Options {
  /** Language to listen in. */
  lang: SpeechLang;
  /** The text already in the box when she taps the mic; what she says is added after it. */
  getBaseText: () => string;
  /** Called with the full box text on every partial and final result. */
  onTranscript: (text: string) => void;
  /** Runs just before the mic opens, e.g. to stop a reply being read aloud. */
  onBeforeStart?: () => void;
}

/** Recognizer errors that need a message, and which one. Others (aborted) are silent. */
const ERROR_MESSAGE_KEY: Partial<Record<ExpoSpeechRecognitionErrorCode, string>> = {
  "no-speech": "chat.voice.noSpeech",
  "speech-timeout": "chat.voice.noSpeech",
  "audio-capture": "chat.voice.noSpeech",
  network: "chat.voice.networkError",
  "language-not-supported": "chat.voice.languageUnavailable",
  "service-not-allowed": "chat.voice.recognitionUnavailable",
  busy: "chat.voice.recognitionUnavailable",
  client: "chat.voice.noSpeech",
  unknown: "chat.voice.noSpeech",
};

const joinText = (base: string, spoken: string) => {
  const head = base.trimEnd();
  const tail = spoken.trim();
  if (!head) return tail;
  if (!tail) return head;
  return `${head} ${tail}`;
};

/**
 * Speech-to-text for the chat box (expo-speech-recognition).
 *
 * On Android this uses Google's recognizer, the same engine as Gboard voice typing,
 * when the phone has it. iOS always uses Apple's recognizer. Words appear in the box
 * as she speaks; nothing is sent until she taps send, so she can fix a misheard word.
 */
export function useSpeechToText({ lang, getBaseText, onTranscript, onBeforeStart }: Options) {
  const { t } = useTranslation();
  const [isListening, setIsListening] = useState(false);
  const baseTextRef = useRef("");
  const gotTextRef = useRef(false);
  const errorRef = useRef<string | null>(null);
  const activeRef = useRef(false);
  const startingRef = useRef(false);
  const langRef = useRef(lang);
  langRef.current = lang;
  const onTranscriptRef = useRef(onTranscript);
  onTranscriptRef.current = onTranscript;

  useSpeechRecognitionEvent("start", () => {
    if (activeRef.current) setIsListening(true);
  });

  useSpeechRecognitionEvent("result", (event) => {
    if (!activeRef.current) return;
    const transcript = event.results[0]?.transcript ?? "";
    if (!transcript.trim()) return;
    gotTextRef.current = true;
    // Partial results replace each other, so always rebuild from the text she had
    // before speaking rather than appending to the last partial.
    onTranscriptRef.current(joinText(baseTextRef.current, transcript));
  });

  useSpeechRecognitionEvent("error", (event) => {
    if (!activeRef.current) return;
    errorRef.current = event.error;
    if (event.error === "aborted") return;
    if (event.error === "not-allowed") {
      showPermissionAlert();
      return;
    }
    // A "no speech" error after words already reached the box is just the recognizer
    // timing out at the end; she has her text, so say nothing.
    if (gotTextRef.current && (event.error === "no-speech" || event.error === "speech-timeout")) return;
    const key = ERROR_MESSAGE_KEY[event.error];
    if (key) Toast.show({ type: "info", text1: t(key), position: "bottom" });
  });

  useSpeechRecognitionEvent("end", () => {
    if (!activeRef.current) return;
    activeRef.current = false;
    setIsListening(false);
    track(AnalyticsEvent.CHAT_VOICE_INPUT_ENDED, {
      lang: langRef.current,
      outcome: gotTextRef.current ? "text" : errorRef.current ?? "no-text",
    });
  });

  const showPermissionAlert = useCallback(() => {
    Alert.alert(t("chat.voice.permissionTitle"), t("chat.voice.permissionDenied"), [
      { text: t("common.cancel"), style: "cancel" },
      { text: t("chat.voice.openSettings"), onPress: () => Linking.openSettings() },
    ]);
  }, [t]);

  /** Prefer Google's recognizer on Android (e.g. over Samsung's Bixby default). */
  const pickAndroidService = (): string | undefined => {
    if (Platform.OS !== "android") return undefined;
    try {
      const services = ExpoSpeechRecognitionModule.getSpeechRecognitionServices();
      return services.includes(GOOGLE_RECOGNIZER) ? GOOGLE_RECOGNIZER : undefined;
    } catch {
      return undefined;
    }
  };

  const start = useCallback(async () => {
    // startingRef covers the permission prompt: a second tap while it is open must
    // not start a second recognition.
    if (activeRef.current || startingRef.current) return;

    if (!ExpoSpeechRecognitionModule.isRecognitionAvailable()) {
      Toast.show({ type: "info", text1: t("chat.voice.recognitionUnavailable"), position: "bottom" });
      return;
    }

    startingRef.current = true;
    let permission;
    try {
      permission = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    } finally {
      startingRef.current = false;
    }
    if (!permission.granted) {
      // Once refused for good the OS won't ask again; only Settings can change it.
      if (!permission.canAskAgain) showPermissionAlert();
      return;
    }

    onBeforeStart?.();
    baseTextRef.current = getBaseText();
    gotTextRef.current = false;
    errorRef.current = null;
    activeRef.current = true;
    setIsListening(true);
    track(AnalyticsEvent.CHAT_VOICE_INPUT_STARTED, { lang });

    ExpoSpeechRecognitionModule.start({
      lang,
      interimResults: true,
      continuous: false,
      addsPunctuation: true,
      maxAlternatives: 1,
      androidRecognitionServicePackage: pickAndroidService(),
    });
  }, [getBaseText, lang, onBeforeStart, showPermissionAlert, t]);

  /** Stop listening and keep what was heard. */
  const stop = useCallback(() => {
    if (activeRef.current) ExpoSpeechRecognitionModule.stop();
  }, []);

  /** Stop listening and drop any result still on its way (e.g. she just tapped send). */
  const abort = useCallback(() => {
    if (!activeRef.current) return;
    activeRef.current = false;
    setIsListening(false);
    ExpoSpeechRecognitionModule.abort();
  }, []);

  const toggle = useCallback(() => {
    if (activeRef.current) stop();
    else start();
  }, [start, stop]);

  // Release the mic if she leaves the chat mid-sentence.
  useEffect(() => () => {
    if (activeRef.current) {
      activeRef.current = false;
      ExpoSpeechRecognitionModule.abort();
    }
  }, []);

  return { isListening, start, stop, abort, toggle };
}
