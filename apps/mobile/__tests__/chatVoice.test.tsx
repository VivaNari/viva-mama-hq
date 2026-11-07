/**
 * Viva AI voice: the mic in the chat bar (speech-to-text), replies read aloud
 * (text-to-speech), the text clean-up both rely on, and en/hi parity of the copy.
 */
import React from "react";
import { act, fireEvent, render, renderHook, waitFor } from "@testing-library/react-native";
import { Alert, Platform, Text } from "react-native";
import * as Speech from "expo-speech";
import { ExpoSpeechRecognitionModule } from "expo-speech-recognition";
import Toast from "react-native-toast-message";

import { ChatBubble } from "../src/components/chatBubble";
import { ChatInputBar } from "../src/components/ChatInputBar";
import { useChatEntry } from "../src/hooks/useChatEntry";
import { useReadAloud } from "../src/hooks/useReadAloud";
import { useSpeechToText } from "../src/hooks/useSpeechToText";
import { useSpokenReplyAutoplay } from "../src/hooks/useSpokenReplyAutoplay";
import {
  chunkForSpeech,
  detectSpeechLang,
  isLikelyHinglish,
  pickIndianEnglishVoice,
  speechLangForAppLanguage,
  toSpeakableText,
  withBrandPronunciation,
} from "../src/utils/messageHelpers";
import en from "../src/i18n/locales/en.json";
import hi from "../src/i18n/locales/hi.json";

jest.mock("../src/analytics", () => ({
  AnalyticsEvent: new Proxy({}, { get: (_t, key) => key }),
  track: jest.fn(),
}));
jest.mock("../src/api/speechText.api", () => ({ getSpeechText: jest.fn() }));
const mockNavigate = jest.fn();
jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({ navigate: mockNavigate }),
}));
// Needs a navigator, and has nothing to do with audio.
jest.mock("../src/components/chatBubble/LogProposalCard", () => ({ LogProposalCard: () => null }));

const emit = (name: string, event?: unknown) =>
  act(() => {
    require("expo-speech-recognition").__emit(name, event);
  });

const result = (transcript: string, isFinal = false) => ({ isFinal, results: [{ transcript, confidence: 1, segments: [] }] });

beforeEach(() => {
  jest.clearAllMocks();
  // A working engine: sound starts as soon as it is asked to speak.
  (Speech.speak as jest.Mock).mockImplementation((_text, options) => options?.onStart?.());
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

  describe("the buttons attached above the box", () => {
    const voice = { isListening: false, onMicPress: jest.fn() };
    const renderTriggers = (hidden: boolean) => (hidden ? null : <Text>triggers</Text>);

    it("show on an empty box and hide as soon as something is written", () => {
      const { queryByText, rerender } = render(
        <ChatInputBar {...base} voice={voice} renderTriggers={renderTriggers} />,
      );
      expect(queryByText("triggers")).toBeTruthy();

      rerender(<ChatInputBar {...base} inputText="h" voice={voice} renderTriggers={renderTriggers} />);
      expect(queryByText("triggers")).toBeNull();

      rerender(<ChatInputBar {...base} inputText="" voice={voice} renderTriggers={renderTriggers} />);
      expect(queryByText("triggers")).toBeTruthy();
    });

    it("hide with a picked file, in step with the mic", () => {
      const { queryByText } = render(
        <ChatInputBar
          {...base}
          voice={voice}
          renderTriggers={renderTriggers}
          attachments={{ onAttachPress: jest.fn(), hasReady: true, blocking: false, full: false }}
        />,
      );
      expect(queryByText("triggers")).toBeNull();
    });

    it("stay away from number and date answers", () => {
      const { queryByText } = render(<ChatInputBar {...base} inputMode="number" renderTriggers={renderTriggers} />);
      expect(queryByText("triggers")).toBeNull();
    });
  });

  describe("swapping with the send button", () => {
    const voice = { isListening: false, onMicPress: jest.fn() };
    const SEND = "Send message";
    const files = (over: object) => ({
      onAttachPress: jest.fn(),
      hasReady: false,
      blocking: false,
      full: false,
      ...over,
    });

    it("shows only the mic on an empty box", () => {
      const { getByLabelText, queryByLabelText } = render(<ChatInputBar {...base} voice={voice} />);
      expect(getByLabelText(en.chat.voice.micA11y)).toBeTruthy();
      expect(queryByLabelText(SEND)).toBeNull();
    });

    it("shows only send as soon as something is written, and swaps back", () => {
      const { getByLabelText, queryByLabelText, rerender } = render(
        <ChatInputBar {...base} inputText="h" voice={voice} />,
      );
      expect(getByLabelText(SEND)).toBeTruthy();
      expect(queryByLabelText(en.chat.voice.micA11y)).toBeNull();

      rerender(<ChatInputBar {...base} inputText="" voice={voice} />);
      expect(getByLabelText(en.chat.voice.micA11y)).toBeTruthy();
      expect(queryByLabelText(SEND)).toBeNull();
    });

    it("keeps the mic for spaces alone, which cannot be sent", () => {
      const { getByLabelText, queryByLabelText } = render(<ChatInputBar {...base} inputText="   " voice={voice} />);
      expect(getByLabelText(en.chat.voice.micA11y)).toBeTruthy();
      expect(queryByLabelText(SEND)).toBeNull();
    });

    it("lets a file with no words be sent", () => {
      const onSend = jest.fn();
      const { getByLabelText, queryByLabelText } = render(
        <ChatInputBar {...base} onSend={onSend} voice={voice} attachments={files({ hasReady: true })} />,
      );
      expect(queryByLabelText(en.chat.voice.micA11y)).toBeNull();
      fireEvent.press(getByLabelText(SEND));
      expect(onSend).toHaveBeenCalled();
    });

    it("shows send, held back, while a file is still uploading", () => {
      const onSend = jest.fn();
      const { getByLabelText } = render(
        <ChatInputBar {...base} onSend={onSend} voice={voice} attachments={files({ blocking: true })} />,
      );
      fireEvent.press(getByLabelText(SEND));
      expect(onSend).not.toHaveBeenCalled();
    });

    it("keeps stop on screen while dictation fills the box", () => {
      const { getByLabelText } = render(
        <ChatInputBar {...base} inputText="my back hurts" voice={{ ...voice, isListening: true }} />,
      );
      expect(getByLabelText(en.chat.voice.stopMicA11y)).toBeTruthy();
      expect(getByLabelText(SEND)).toBeTruthy();
    });

    it("shows only stop while listening before any words arrive", () => {
      const { getByLabelText, queryByLabelText } = render(
        <ChatInputBar {...base} voice={{ ...voice, isListening: true }} />,
      );
      expect(getByLabelText(en.chat.voice.stopMicA11y)).toBeTruthy();
      expect(queryByLabelText(SEND)).toBeNull();
    });

    it("keeps send on screens with no mic", () => {
      const withoutVoice = render(<ChatInputBar {...base} />);
      expect(withoutVoice.getByLabelText(SEND)).toBeTruthy();

      const numberAnswer = render(<ChatInputBar {...base} inputMode="number" voice={voice} />);
      expect(numberAnswer.getByLabelText(SEND)).toBeTruthy();
    });
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

describe("brand pronunciation", () => {
  it.each([
    ["VivaMama can help", "Veevamama can help"],
    ["Welcome to Vivamama.", "Welcome to Veevamama."],
    ["Viva Mama and viva-mama", "Veevamama and Veevamama"],
    ["I am Viva, and this is Viva's plan", "I am Veeva, and this is Veeva's plan"],
  ])("respells %s for the English voice", (written, spoken) => {
    expect(withBrandPronunciation(written, "en-IN")).toBe(spoken);
  });

  it("uses Devanagari for the Hindi voice", () => {
    expect(withBrandPronunciation("VivaMama और Viva", "hi-IN")).toBe("वीवामामा और वीवा");
  });

  it("leaves words that only contain the name alone", () => {
    expect(withBrandPronunciation("Survival and revival", "en-IN")).toBe("Survival and revival");
  });

  it("changes what is spoken, not the reply itself", async () => {
    const { result: hook } = renderHook(() => useReadAloud());
    const reply = "**VivaMama** is with you";

    await act(() => hook.current.toggle("m1", reply));

    await waitFor(() => expect(Speech.speak).toHaveBeenCalled());
    expect(Speech.speak).toHaveBeenCalledWith(
      "Veevamama is with you",
      expect.objectContaining({ language: "en-IN" }),
    );
    expect(reply).toBe("**VivaMama** is with you");
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

describe("Indian English voice", () => {
  // The voices a Poco M2 Pro running Google's engine reports, in the order it gives them.
  const PHONE_VOICES = [
    { identifier: "en-us-x-sfg-local", language: "en-US" },
    { identifier: "en-in-x-ene-network", language: "en-IN" },
    { identifier: "en-in-x-enc-local", language: "en-IN" },
    { identifier: "en-IN-language", language: "en-IN" },
    { identifier: "hi-in-x-hia-local", language: "hi-IN" },
  ].map((voice) => ({ ...voice, name: voice.identifier, quality: "Enhanced" }));

  const originalOS = Platform.OS;

  beforeEach(() => {
    Platform.OS = "android";
  });

  afterEach(() => {
    Platform.OS = originalOS;
  });

  const speakAndGetOptions = async (text: string, voices = PHONE_VOICES) => {
    (Speech.getAvailableVoicesAsync as jest.Mock).mockResolvedValueOnce(voices);
    const { result: hook } = renderHook(() => useReadAloud());
    await act(() => hook.current.toggle("m1", text));
    return (Speech.speak as jest.Mock).mock.calls[0][1];
  };

  it("reads an English reply in the Indian English voice on Android", async () => {
    const options = await speakAndGetOptions("You should rest");
    expect(options).toEqual(expect.objectContaining({ language: "en-IN", voice: "en-IN-language" }));
  });

  it("leaves Hindi replies to the Hindi voice", async () => {
    const options = await speakAndGetOptions("आराम करें");
    expect(options.language).toBe("hi-IN");
    expect(options.voice).toBeUndefined();
  });

  it("leaves iOS to the language setting, which it honours", async () => {
    Platform.OS = "ios";
    const options = await speakAndGetOptions("You should rest");
    expect(options.language).toBe("en-IN");
    expect(options.voice).toBeUndefined();
  });

  it("still reads the reply on a phone with no Indian English voice", async () => {
    const options = await speakAndGetOptions("You should rest", [PHONE_VOICES[0]]);
    expect(options.voice).toBeUndefined();
    expect(Speech.speak).toHaveBeenCalled();
  });

  it("prefers a stored voice over a network one when there is no default entry", () => {
    expect(
      pickIndianEnglishVoice([
        { identifier: "en-in-x-ene-network", language: "en-IN" },
        { identifier: "en-in-x-enc-local", language: "en-IN" },
      ]),
    ).toBe("en-in-x-enc-local");
  });

  it("never picks a voice from another country", () => {
    expect(pickIndianEnglishVoice([{ identifier: "en-us-x-sfg-local", language: "en-US" }])).toBeUndefined();
    expect(pickIndianEnglishVoice([])).toBeUndefined();
  });
});

describe("Hinglish replies", () => {
  const HINGLISH = "Aapko **aaram** karna chahiye";
  const SPOKEN = "Aapko aaram karna chahiye";
  const DEVANAGARI = "आपको आराम करना चाहिए";
  const getSpeechText = jest.requireMock("../src/api/speechText.api").getSpeechText as jest.Mock;

  it("are recognised without catching ordinary English", () => {
    expect(isLikelyHinglish("Aapko aaram karna chahiye")).toBe(true);
    expect(isLikelyHinglish("Kya aap theek hain?")).toBe(true);
    expect(isLikelyHinglish("You should rest and drink water.")).toBe(false);
    // One Hindi word alone: a name or a borrowed word in an English reply.
    expect(isLikelyHinglish("Your doctor Dr. Rahi will call you.")).toBe(false);
    expect(isLikelyHinglish("The main thing is agar in the din of the ward.")).toBe(false);
    expect(isLikelyHinglish("आपको आराम करना चाहिए")).toBe(false);
  });

  it("are spoken in Devanagari with the Hindi voice", async () => {
    getSpeechText.mockResolvedValueOnce(DEVANAGARI);
    const { result: hook } = renderHook(() => useReadAloud());
    await act(() => hook.current.toggle("m1", HINGLISH));
    expect(getSpeechText).toHaveBeenCalledWith(SPOKEN);
    expect(Speech.speak).toHaveBeenCalledWith(DEVANAGARI, expect.objectContaining({ language: "hi-IN" }));
    expect(hook.current.speakingId).toBe("m1");
    expect(hook.current.preparingId).toBeNull();
  });

  it("are converted once, however often they are replayed", async () => {
    getSpeechText.mockResolvedValueOnce(DEVANAGARI);
    const { result: hook } = renderHook(() => useReadAloud());
    await act(() => hook.current.toggle("m1", HINGLISH));
    act(() => hook.current.toggle("m1", HINGLISH));
    await act(() => hook.current.toggle("m1", HINGLISH));
    expect(getSpeechText).toHaveBeenCalledTimes(1);
    expect(Speech.speak).toHaveBeenCalledTimes(2);
  });

  it("don't call the server when English is being read", async () => {
    const { result: hook } = renderHook(() => useReadAloud());
    await act(() => hook.current.toggle("m1", "You should rest"));
    expect(getSpeechText).not.toHaveBeenCalled();
    expect(Speech.speak).toHaveBeenCalledWith("You should rest", expect.objectContaining({ language: "en-IN" }));
  });

  it("never fall back to the English voice when conversion fails", async () => {
    getSpeechText.mockRejectedValueOnce(new Error("offline"));
    const { result: hook } = renderHook(() => useReadAloud());
    await act(() => hook.current.toggle("m1", HINGLISH));
    expect(Speech.speak).not.toHaveBeenCalled();
    expect(Toast.show).toHaveBeenCalledWith(expect.objectContaining({ text1: en.chat.voice.speakFailed }));
    expect(hook.current.preparingId).toBeNull();
    expect(hook.current.speakingId).toBeNull();
  });

  it("reject a conversion that came back without Devanagari", async () => {
    getSpeechText.mockResolvedValueOnce(SPOKEN);
    const { result: hook } = renderHook(() => useReadAloud());
    await act(() => hook.current.toggle("m1", HINGLISH));
    expect(Speech.speak).not.toHaveBeenCalled();
    expect(Toast.show).toHaveBeenCalled();
  });

  it("show the loading state, and a tap during it cancels the reply", async () => {
    let resolve: (text: string) => void = () => undefined;
    getSpeechText.mockReturnValueOnce(new Promise((r) => (resolve = r)));
    const { result: hook } = renderHook(() => useReadAloud());
    await act(async () => {
      hook.current.toggle("m1", HINGLISH);
    });
    await waitFor(() => expect(hook.current.preparingId).toBe("m1"));

    act(() => hook.current.toggle("m1", HINGLISH));
    expect(hook.current.preparingId).toBeNull();
    await act(async () => resolve(DEVANAGARI));
    expect(Speech.speak).not.toHaveBeenCalled();
    expect(hook.current.speakingId).toBeNull();
  });
});

describe("speaking wave", () => {
  const WAVE = "speaking-wave";
  const bubbleProps = {
    isLast: true,
    isFirst: false,
    isAnimating: false,
    isFlowComplete: false,
    selectedMultiOptions: new Set<string>(),
    onOptionSelect: jest.fn(),
    onMultiOptionToggle: jest.fn(),
    onDatePickerOpen: jest.fn(),
    onLmpDatePickerOpen: jest.fn(),
    onNotPregnantSelect: jest.fn(),
    onConsultExpert: jest.fn(),
    onChatWithViva: jest.fn(),
    onBookmarkPress: jest.fn(),
    onAnimationComplete: jest.fn(),
    onSpeakPress: jest.fn(),
    message: { id: "m1", type: "ai", flowInstanceId: "chatbot", text: "Rest well", options: [] } as any,
  };
  // The wave is hidden from screen readers, and queries skip hidden elements by default:
  // without this the "isn't shown" tests would pass even with the wave on screen.
  const HIDDEN = { includeHiddenElements: true };

  // The finished bubble (after a tap, or once typing ends) and the typing bubble (a
  // reply to a spoken question plays while it types).
  describe.each([
    ["finished", false],
    ["typing", true],
  ])("on a %s reply", (_name, shouldAnimate) => {
    it("moves while audio plays, and stops the reply when tapped", () => {
      const { getByTestId, getByLabelText } = render(
        <ChatBubble {...bubbleProps} shouldAnimate={shouldAnimate} isSpeaking />,
      );
      expect(getByTestId(WAVE, HIDDEN)).toBeTruthy();
      fireEvent.press(getByLabelText(en.chat.voice.stopA11y));
      expect(bubbleProps.onSpeakPress).toHaveBeenCalledWith("m1", "Rest well");
    });

    it("isn't shown before the sound starts", () => {
      const { queryByTestId } = render(
        <ChatBubble {...bubbleProps} shouldAnimate={shouldAnimate} isPreparingSpeech />,
      );
      expect(queryByTestId(WAVE, HIDDEN)).toBeNull();
    });

    it("isn't shown when nothing is playing", () => {
      const { queryByTestId } = render(
        <ChatBubble {...bubbleProps} shouldAnimate={shouldAnimate} />,
      );
      expect(queryByTestId(WAVE, HIDDEN)).toBeNull();
    });
  });

  it("follows the engine: waiting, then playing, then finished", async () => {
    (Speech.speak as jest.Mock).mockImplementationOnce(() => undefined);
    const { result: hook } = renderHook(() => useReadAloud());
    await act(() => hook.current.toggle("m1", "You should rest"));
    expect(hook.current.preparingId).toBe("m1");
    expect(hook.current.speakingId).toBeNull();

    const options = (Speech.speak as jest.Mock).mock.calls[0][1];
    act(() => options.onStart());
    expect(hook.current.preparingId).toBeNull();
    expect(hook.current.speakingId).toBe("m1");

    act(() => options.onDone());
    expect(hook.current.speakingId).toBeNull();
  });

  it("clears the waiting state if the engine fails before any sound", async () => {
    (Speech.speak as jest.Mock).mockImplementationOnce(() => undefined);
    const { result: hook } = renderHook(() => useReadAloud());
    await act(() => hook.current.toggle("m1", "You should rest"));
    const options = (Speech.speak as jest.Mock).mock.calls[0][1];
    act(() => options.onError(new Error("timeout")));
    expect(hook.current.preparingId).toBeNull();
    expect(hook.current.speakingId).toBeNull();
    expect(Toast.show).toHaveBeenCalled();
  });
});

describe("useSpokenReplyAutoplay", () => {
  const ai = (id: string, text = "Reply") => ({ id, type: "ai", text, options: [] }) as any;
  const user = (id: string) => ({ id, type: "user", text: "Question" }) as any;

  const setup = () => {
    const play = jest.fn();
    const hook = renderHook(
      (props: { inputText: string; lastMessage: any }) => useSpokenReplyAutoplay({ ...props, play }),
      { initialProps: { inputText: "", lastMessage: ai("a1") } },
    );
    return { ...hook, play };
  };

  it("plays the reply to a spoken question, once", () => {
    const { result: hook, rerender, play } = setup();
    hook.current.markSpoken();
    rerender({ inputText: "मुझे दर्द है", lastMessage: ai("a1") });
    hook.current.noteSent();
    rerender({ inputText: "", lastMessage: user("u1") });
    expect(play).not.toHaveBeenCalled();

    rerender({ inputText: "", lastMessage: ai("a2", "आराम करें") });
    expect(play).toHaveBeenCalledTimes(1);
    expect(play).toHaveBeenCalledWith("a2", "आराम करें");

    rerender({ inputText: "", lastMessage: ai("a3") });
    expect(play).toHaveBeenCalledTimes(1);
  });

  it("stays silent for a typed question", () => {
    const { result: hook, rerender, play } = setup();
    rerender({ inputText: "typed", lastMessage: ai("a1") });
    hook.current.noteSent();
    rerender({ inputText: "", lastMessage: user("u1") });
    rerender({ inputText: "", lastMessage: ai("a2") });
    expect(play).not.toHaveBeenCalled();
  });

  it("still plays when she corrected the spoken words by hand", () => {
    const { result: hook, rerender, play } = setup();
    hook.current.markSpoken();
    rerender({ inputText: "spoken", lastMessage: ai("a1") });
    rerender({ inputText: "spoken and corrected", lastMessage: ai("a1") });
    hook.current.noteSent();
    rerender({ inputText: "", lastMessage: ai("a2") });
    expect(play).toHaveBeenCalledTimes(1);
  });

  it("forgets the mic once she empties the box and types instead", () => {
    const { result: hook, rerender, play } = setup();
    hook.current.markSpoken();
    rerender({ inputText: "spoken", lastMessage: ai("a1") });
    rerender({ inputText: "", lastMessage: ai("a1") });
    rerender({ inputText: "typed", lastMessage: ai("a1") });
    hook.current.noteSent();
    rerender({ inputText: "", lastMessage: ai("a2") });
    expect(play).not.toHaveBeenCalled();
  });

  it("doesn't carry over to the next typed question", () => {
    const { result: hook, rerender, play } = setup();
    hook.current.markSpoken();
    rerender({ inputText: "spoken", lastMessage: ai("a1") });
    hook.current.noteSent();
    rerender({ inputText: "", lastMessage: ai("a2") });
    rerender({ inputText: "typed", lastMessage: ai("a2") });
    hook.current.noteSent();
    rerender({ inputText: "", lastMessage: ai("a3") });
    expect(play).toHaveBeenCalledTimes(1);
  });

  it("doesn't start if she left or opened the mic while waiting", () => {
    const { result: hook, rerender, play } = setup();
    hook.current.markSpoken();
    rerender({ inputText: "spoken", lastMessage: ai("a1") });
    hook.current.noteSent();
    hook.current.cancel();
    rerender({ inputText: "", lastMessage: ai("a2") });
    expect(play).not.toHaveBeenCalled();
  });
});

describe("arriving from the Viva AI hub", () => {
  const setup = (entry: "type" | "voice" | undefined, canAsk = true) => {
    const skipAnimation = jest.fn();
    const startListening = jest.fn();
    const hook = renderHook(
      (props: { inputMode: any; isAnimating: boolean }) =>
        useChatEntry({ entry, canAsk, skipAnimation, startListening, ...props }),
      { initialProps: { inputMode: "none", isAnimating: false } },
    );
    return { ...hook, skipAnimation, startListening };
  };
  const ready = { inputMode: "text", isAnimating: false };

  it("waits for chat to be ready, skips the welcome typing, then listens once", () => {
    const { rerender, skipAnimation, startListening } = setup("voice");
    expect(startListening).not.toHaveBeenCalled();

    rerender({ inputMode: "none", isAnimating: true });
    expect(skipAnimation).toHaveBeenCalledTimes(1);
    expect(startListening).not.toHaveBeenCalled();

    rerender(ready);
    expect(startListening).toHaveBeenCalledTimes(1);

    rerender({ inputMode: "none", isAnimating: true });
    rerender(ready);
    expect(startListening).toHaveBeenCalledTimes(1);
    expect(skipAnimation).toHaveBeenCalledTimes(1);
  });

  it("keeps the mic closed when she has no questions left", () => {
    const { rerender, startListening } = setup("voice", false);
    rerender(ready);
    expect(startListening).not.toHaveBeenCalled();
  });

  it("doesn't open the mic after she left", () => {
    const { result: hook, rerender, startListening } = setup("voice");
    act(() => hook.current.cancel());
    rerender(ready);
    expect(startListening).not.toHaveBeenCalled();
  });

  it("opens the keyboard for the text box, not the mic, until she sends", () => {
    const { result: hook, rerender, startListening } = setup("type");
    expect(hook.current.autoFocus).toBe(true);
    rerender(ready);
    expect(startListening).not.toHaveBeenCalled();
    act(() => hook.current.cancel());
    expect(hook.current.autoFocus).toBe(false);
  });

  it("leaves other ways into chat untouched", () => {
    const { result: hook, rerender, skipAnimation, startListening } = setup(undefined);
    rerender({ inputMode: "none", isAnimating: true });
    rerender(ready);
    expect(hook.current.autoFocus).toBe(false);
    expect(skipAnimation).not.toHaveBeenCalled();
    expect(startListening).not.toHaveBeenCalled();
  });
});

describe("voice copy", () => {
  it("has every key in both languages", () => {
    expect(Object.keys(hi.chat.voice).sort()).toEqual(Object.keys(en.chat.voice).sort());
  });
});
