/**
 * Viva AI voice: the mic in the chat bar (speech-to-text), replies read aloud
 * (text-to-speech), the text clean-up both rely on, and en/hi parity of the copy.
 */
import React from "react";
import { act, fireEvent, render, renderHook, waitFor } from "@testing-library/react-native";
import { Alert } from "react-native";
import * as Speech from "expo-speech";
import { ExpoSpeechRecognitionModule } from "expo-speech-recognition";
import Toast from "react-native-toast-message";

import { ChatInputBar } from "../src/components/ChatInputBar";
import { useReadAloud } from "../src/hooks/useReadAloud";
import { useSpeechToText } from "../src/hooks/useSpeechToText";
import {
  chunkForSpeech,
  detectSpeechLang,
  speechLangForAppLanguage,
  toSpeakableText,
} from "../src/utils/messageHelpers";
import en from "../src/i18n/locales/en.json";
import hi from "../src/i18n/locales/hi.json";

jest.mock("../src/analytics", () => ({
  AnalyticsEvent: new Proxy({}, { get: (_t, key) => key }),
  track: jest.fn(),
}));

const emit = (name: string, event?: unknown) =>
  act(() => {
    require("expo-speech-recognition").__emit(name, event);
  });

const result = (transcript: string, isFinal = false) => ({ isFinal, results: [{ transcript, confidence: 1, segments: [] }] });

beforeEach(() => {
  jest.clearAllMocks();
});

describe("speech text helpers", () => {
  it("strips markdown so the voice doesn't read symbols", () => {
    const md = "## Tips\n**Rest** well and *drink water*.\n* Eat iron-rich food\n1. See [your doctor](https://x.y/z) 😊";
    expect(toSpeakableText(md)).toBe("Tips. Rest well and drink water. Eat iron-rich food. See your doctor");
  });

  it("keeps Hindi text intact and ends lines on the danda", () => {
    expect(toSpeakableText("**आराम** करें।\nपानी पिएँ")).toBe("आराम करें। पानी पिएँ");
  });

  it("chooses the voice from the reply's script, not the app language", () => {
    expect(detectSpeechLang("आपको आराम करना चाहिए")).toBe("hi-IN");
    expect(detectSpeechLang("You should rest")).toBe("en-IN");
    expect(speechLangForAppLanguage("hi")).toBe("hi-IN");
    expect(speechLangForAppLanguage("en")).toBe("en-IN");
    expect(speechLangForAppLanguage(undefined)).toBe("en-IN");
  });

  it("splits long text on sentence ends within the engine limit", () => {
    const text = "One two three. Four five six. Seven eight nine.";
    const chunks = chunkForSpeech(text, 20);
    expect(chunks).toEqual(["One two three.", "Four five six.", "Seven eight nine."]);
    chunks.forEach((c) => expect(c.length).toBeLessThanOrEqual(20));
    expect(chunkForSpeech("short", 20)).toEqual(["short"]);
  });
});

describe("ChatInputBar mic", () => {
  const base = {
    inputMode: "text" as const,
    inputText: "",
    isLoading: false,
    selectedOptionsCount: 0,
    onInputChange: jest.fn(),
    onSend: jest.fn(),
    onDatePickerOpen: jest.fn(),
    onMultiSelectSubmit: jest.fn(),
  };

  it("is absent without the voice prop (guided check-ins)", () => {
    const { queryByLabelText } = render(<ChatInputBar {...base} />);
    expect(queryByLabelText(en.chat.voice.micA11y)).toBeNull();
  });

  it("is absent outside text answers", () => {
    const { queryByLabelText } = render(
      <ChatInputBar {...base} inputMode="number" voice={{ isListening: false, onMicPress: jest.fn() }} />,
    );
    expect(queryByLabelText(en.chat.voice.micA11y)).toBeNull();
  });

  it("starts and shows the listening state", () => {
    const onMicPress = jest.fn();
    const { getByLabelText, rerender, getByPlaceholderText } = render(
      <ChatInputBar {...base} voice={{ isListening: false, onMicPress }} />,
    );
    fireEvent.press(getByLabelText(en.chat.voice.micA11y));
    expect(onMicPress).toHaveBeenCalled();

    rerender(<ChatInputBar {...base} voice={{ isListening: true, onMicPress }} />);
    expect(getByLabelText(en.chat.voice.stopMicA11y)).toBeTruthy();
    expect(getByPlaceholderText(en.chat.voice.listening)).toBeTruthy();
  });

  it("can't start while Viva is replying, but can still be stopped", () => {
    const onMicPress = jest.fn();
    const { getByLabelText, rerender } = render(
      <ChatInputBar {...base} isLoading voice={{ isListening: false, onMicPress }} />,
    );
    fireEvent.press(getByLabelText(en.chat.voice.micA11y));
    expect(onMicPress).not.toHaveBeenCalled();

    rerender(<ChatInputBar {...base} isLoading voice={{ isListening: true, onMicPress }} />);
    fireEvent.press(getByLabelText(en.chat.voice.stopMicA11y));
    expect(onMicPress).toHaveBeenCalled();
  });
});

describe("useSpeechToText", () => {
  const setup = (baseText = "") => {
    const onTranscript = jest.fn();
    const onBeforeStart = jest.fn();
    const hook = renderHook(() =>
      useSpeechToText({ lang: "hi-IN", getBaseText: () => baseText, onTranscript, onBeforeStart }),
    );
    return { ...hook, onTranscript, onBeforeStart };
  };

  it("stops read-aloud, then listens in the given language", async () => {
    const { result: hook, onBeforeStart } = setup();
    await act(() => hook.current.start());
    expect(onBeforeStart).toHaveBeenCalled();
    expect(ExpoSpeechRecognitionModule.start).toHaveBeenCalledWith(
      expect.objectContaining({ lang: "hi-IN", interimResults: true, continuous: false }),
    );
    expect(hook.current.isListening).toBe(true);
  });

  it("replaces partial results after the text already in the box", async () => {
    const { result: hook, onTranscript } = setup("मुझे");
    await act(() => hook.current.start());
    emit("result", result("पीठ"));
    emit("result", result("पीठ में दर्द है", true));
    expect(onTranscript).toHaveBeenNthCalledWith(1, "मुझे पीठ");
    expect(onTranscript).toHaveBeenLastCalledWith("मुझे पीठ में दर्द है");
    emit("end");
    expect(hook.current.isListening).toBe(false);
  });

  it("explains when nothing was heard", async () => {
    const { result: hook } = setup();
    await act(() => hook.current.start());
    emit("error", { error: "no-speech", message: "" });
    expect(Toast.show).toHaveBeenCalledWith(expect.objectContaining({ text1: expect.any(String) }));
  });

  it("stays quiet about a timeout once words reached the box", async () => {
    const { result: hook } = setup();
    await act(() => hook.current.start());
    emit("result", result("hello", true));
    emit("error", { error: "no-speech", message: "" });
    expect(Toast.show).not.toHaveBeenCalled();
  });

  it("points to Settings when the mic was refused for good", async () => {
    (ExpoSpeechRecognitionModule.requestPermissionsAsync as jest.Mock).mockResolvedValueOnce({
      granted: false,
      canAskAgain: false,
    });
    const alert = jest.spyOn(Alert, "alert").mockImplementation(() => undefined);
    const { result: hook } = setup();
    await act(() => hook.current.start());
    expect(ExpoSpeechRecognitionModule.start).not.toHaveBeenCalled();
    expect(alert).toHaveBeenCalled();
  });

  it("drops late results after abort (she tapped send)", async () => {
    const { result: hook, onTranscript } = setup();
    await act(() => hook.current.start());
    act(() => hook.current.abort());
    emit("result", result("late"));
    expect(onTranscript).not.toHaveBeenCalled();
    expect(ExpoSpeechRecognitionModule.abort).toHaveBeenCalled();
  });
});

describe("useReadAloud", () => {
  it("reads a Hindi reply in a Hindi voice, without markdown", async () => {
    const { result: hook } = renderHook(() => useReadAloud());
    await act(() => hook.current.toggle("m1", "**आराम** करें"));
    await waitFor(() => expect(Speech.speak).toHaveBeenCalled());
    expect(Speech.speak).toHaveBeenCalledWith("आराम करें", expect.objectContaining({ language: "hi-IN" }));
    expect(hook.current.speakingId).toBe("m1");
  });

  it("plays one reply at a time and stops on a second tap", async () => {
    const { result: hook } = renderHook(() => useReadAloud());
    await act(() => hook.current.toggle("m1", "First"));
    await act(() => hook.current.toggle("m2", "Second"));
    expect(hook.current.speakingId).toBe("m2");
    act(() => hook.current.toggle("m2", "Second"));
    expect(hook.current.speakingId).toBeNull();
    expect(Speech.stop).toHaveBeenCalled();
  });

  it("says so instead of reading Hindi with an English voice", async () => {
    (Speech.getAvailableVoicesAsync as jest.Mock).mockResolvedValueOnce([
      { identifier: "en", name: "en", quality: "Default", language: "en-IN" },
    ]);
    const { result: hook } = renderHook(() => useReadAloud());
    await act(() => hook.current.toggle("m1", "नमस्ते"));
    expect(Speech.speak).not.toHaveBeenCalled();
    expect(Toast.show).toHaveBeenCalled();
    expect(hook.current.speakingId).toBeNull();
  });

  it("clears the playing state when the reply finishes", async () => {
    const { result: hook } = renderHook(() => useReadAloud());
    await act(() => hook.current.toggle("m1", "Done soon"));
    const options = (Speech.speak as jest.Mock).mock.calls[0][1];
    act(() => options.onDone());
    expect(hook.current.speakingId).toBeNull();
  });
});

describe("voice copy", () => {
  it("has every key in both languages", () => {
    expect(Object.keys(hi.chat.voice).sort()).toEqual(Object.keys(en.chat.voice).sort());
  });
});
