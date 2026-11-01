/**
 * Attachments in Viva AI chat: the composer, the tray, the state they live in, and
 * the turn sent to the server.
 */
import React from "react";
import { act, fireEvent, render, renderHook } from "@testing-library/react-native";

const mockPost = jest.fn();
jest.mock("../src/api/apiClientInterceptor", () => ({
  __esModule: true,
  default: () => ({ post: mockPost, get: jest.fn(), delete: jest.fn() }),
}));

jest.mock("@react-native-vector-icons/lucide", () => {
  const React = require("react");
  const Icon = (props: any) => React.createElement("Icon", props);
  return { __esModule: true, default: Icon, Lucide: Icon };
});

jest.mock("../src/analytics", () => ({
  AnalyticsEvent: new Proxy({}, { get: (_t, key) => key }),
  track: jest.fn(),
  lengthBucket: () => "xs",
  byteSizeBucket: () => "s",
  recordError: jest.fn(),
}));

import { ChatInputBar } from "../src/components/ChatInputBar";
import AttachmentPreviewTray from "../src/components/chatAttachments/AttachmentPreviewTray";
import { INITIAL_CHAT_STATE } from "../src/constants/chat";
import { useChatActions } from "../src/hooks/useChatActions";
import en from "../src/i18n/locales/en.json";
import hi from "../src/i18n/locales/hi.json";
import { chatReducer } from "../src/reducers/chatReducer";
import { ChatState, FlowType, IPendingAttachment } from "../src/types/chat.types";
import {
  canAdd,
  errorCodeToI18nKey,
  newUuid,
  readyAttachments,
  serverErrorCode,
} from "../src/utils/attachments";

const pending = (overrides: Partial<IPendingAttachment> = {}): IPendingAttachment => ({
  localId: "l1",
  clientUploadId: "c1",
  kind: "IMAGE",
  uri: "file:///cache/a.jpg",
  mimeType: "image/jpeg",
  state: "uploaded",
  progress: 1,
  serverId: "6720aaaaaaaaaaaaaaaaaaaa",
  ...overrides,
});

const baseState = (): ChatState => ({ ...INITIAL_CHAT_STATE, selectedMultiOptions: new Set() } as ChatState);

describe("chatReducer: attachments", () => {
  it("adds, updates and removes picked files", () => {
    let state = chatReducer(baseState(), { type: "ADD_PENDING_ATTACHMENTS", payload: [pending({ state: "uploading", progress: 0 })] });
    state = chatReducer(state, { type: "UPDATE_PENDING_ATTACHMENT", payload: { localId: "l1", patch: { progress: 0.5 } } });
    expect(state.pendingAttachments[0].progress).toBe(0.5);
    state = chatReducer(state, { type: "REMOVE_PENDING_ATTACHMENT", payload: "l1" });
    expect(state.pendingAttachments).toEqual([]);
  });

  it("updates one of her messages in place by its id", () => {
    let state = chatReducer(baseState(), {
      type: "ADD_MESSAGE",
      payload: { type: "user", id: "m1", text: "", timestamp: 1, status: "sending" },
    });
    state = chatReducer(state, { type: "UPDATE_USER_MESSAGE", payload: { id: "m1", patch: { status: "failed" } } });
    expect(state.messages[0]).toMatchObject({ id: "m1", status: "failed" });
  });
});

describe("attachment helpers", () => {
  it("allows up to the limit of photos, or exactly one PDF", () => {
    expect(canAdd([], "IMAGE", 3, 3)).toBe("ok");
    expect(canAdd([pending()], "IMAGE", 3, 3)).toBe("too_many");
    expect(canAdd([pending()], "PDF", 1, 3)).toBe("mixed");
    expect(canAdd([pending({ kind: "PDF" })], "IMAGE", 1, 3)).toBe("mixed");
    expect(canAdd([], "PDF", 2, 3)).toBe("too_many");
  });

  it("only treats uploaded files as ready", () => {
    expect(readyAttachments([pending(), pending({ localId: "l2", state: "uploading" })])).toHaveLength(1);
  });

  it("makes v4 UUIDs the server accepts", () => {
    expect(newUuid()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it("reads the server's code, and maps unknown codes to a generic message", () => {
    expect(serverErrorCode({ response: { data: { data: { code: "ATTACHMENT_TOO_LARGE" } } } })).toBe("ATTACHMENT_TOO_LARGE");
    expect(serverErrorCode({ code: "ERR_NETWORK" })).toBe("NETWORK");
    expect(errorCodeToI18nKey("ATTACHMENT_TOO_LARGE")).toBe("chat.attachments.errors.ATTACHMENT_TOO_LARGE");
    expect(errorCodeToI18nKey("SOMETHING_NEW")).toBe("chat.attachments.errors.GENERIC");
  });
});

describe("ChatInputBar with attachments", () => {
  const props = {
    inputMode: "text" as const,
    inputText: "",
    isLoading: false,
    selectedOptionsCount: 0,
    onInputChange: jest.fn(),
    onSend: jest.fn(),
    onDatePickerOpen: jest.fn(),
    onMultiSelectSubmit: jest.fn(),
  };
  const attach = (overrides = {}) => ({
    onAttachPress: jest.fn(),
    hasReady: false,
    blocking: false,
    full: false,
    ...overrides,
  });

  it("has no paperclip outside Viva AI", () => {
    const { queryByLabelText } = render(<ChatInputBar {...props} />);
    expect(queryByLabelText(en.chat.attachments.a11y.attach)).toBeNull();
  });

  it("opens the attach sheet from the paperclip", () => {
    const attachments = attach();
    const { getByLabelText } = render(<ChatInputBar {...props} attachments={attachments} />);
    fireEvent.press(getByLabelText(en.chat.attachments.a11y.attach));
    expect(attachments.onAttachPress).toHaveBeenCalled();
  });

  it("sends a message that is only a file", () => {
    const onSend = jest.fn();
    const { getByLabelText, getByPlaceholderText } = render(
      <ChatInputBar {...props} onSend={onSend} attachments={attach({ hasReady: true })} />,
    );
    getByPlaceholderText(en.chat.attachments.addQuestion);
    fireEvent.press(getByLabelText("Send message"));
    expect(onSend).toHaveBeenCalled();
  });

  it("waits for uploads before sending, even with text", () => {
    const onSend = jest.fn();
    const { getByLabelText } = render(
      <ChatInputBar {...props} inputText="is this ok?" onSend={onSend} attachments={attach({ blocking: true, hasReady: true })} />,
    );
    fireEvent.press(getByLabelText("Send message"));
    expect(onSend).not.toHaveBeenCalled();
  });

  it("never shows the paperclip in date or number questions", () => {
    const { queryByLabelText } = render(<ChatInputBar {...props} inputMode="number" attachments={attach()} />);
    expect(queryByLabelText(en.chat.attachments.a11y.attach)).toBeNull();
  });
});

describe("AttachmentPreviewTray", () => {
  it("removes and retries files, and says why an upload failed", () => {
    const onRemove = jest.fn();
    const onRetry = jest.fn();
    const items = [
      pending(),
      pending({ localId: "l2", state: "failed", errorCode: "ATTACHMENT_TOO_LARGE", serverId: undefined }),
    ];
    const { getByLabelText, getByText } = render(
      <AttachmentPreviewTray items={items} onRemove={onRemove} onRetry={onRetry} />,
    );
    fireEvent.press(getByLabelText("Remove attachment 1 of 2"));
    expect(onRemove).toHaveBeenCalledWith("l1");
    fireEvent.press(getByLabelText(/Photo 2 of 2\. Upload failed/));
    expect(onRetry).toHaveBeenCalledWith("l2");
    getByText(new RegExp(en.chat.attachments.errors.ATTACHMENT_TOO_LARGE));
  });

  it("renders nothing when empty", () => {
    const { toJSON } = render(<AttachmentPreviewTray items={[]} onRemove={jest.fn()} onRetry={jest.fn()} />);
    expect(toJSON()).toBeNull();
  });
});

describe("sending a turn with files", () => {
  beforeEach(() => mockPost.mockReset());

  const setup = (overrides = {}) => {
    const dispatch = jest.fn();
    const onTurnSent = jest.fn();
    const onSendFailed = jest.fn();
    const { result } = renderHook(() =>
      useChatActions({
        state: baseState(),
        userId: "u1",
        flowType: FlowType.CHATBOT,
        dispatch,
        getLastAiMessage: jest.fn(),
        saveUserMessage: jest.fn(),
        onTurnSent,
        onSendFailed,
        ...overrides,
      }),
    );
    return { result, dispatch, onTurnSent, onSendFailed };
  };

  it("posts the file ids with a clientMessageId and shows the files at once", async () => {
    mockPost.mockResolvedValue({ data: { data: { quota: null } } });
    const { result, dispatch, onTurnSent } = setup();

    await act(() => result.current.handleTextSubmit("", [pending()]));

    const body = mockPost.mock.calls[0][1];
    expect(body.attachmentIds).toEqual(["6720aaaaaaaaaaaaaaaaaaaa"]);
    expect(body.clientMessageId).toMatch(/^[0-9a-f-]{36}$/);
    expect(body.freeText).toBe("");
    const added = dispatch.mock.calls.find(([a]) => a.type === "ADD_MESSAGE")[0].payload;
    expect(added).toMatchObject({ type: "user", id: body.clientMessageId, status: "sending" });
    expect(added.attachments[0]).toMatchObject({ kind: "IMAGE", localUri: "file:///cache/a.jpg" });
    expect(onTurnSent).toHaveBeenCalledWith(body.clientMessageId, true);
  });

  it("gives the files back when she is out of questions", async () => {
    mockPost.mockRejectedValue({ response: { status: 402, data: { data: { code: "QUOTA_EXCEEDED" } } } });
    const { result, dispatch, onSendFailed } = setup();

    await act(() => result.current.handleTextSubmit("what is this?", [pending()]));

    expect(onSendFailed).toHaveBeenCalledWith([expect.objectContaining({ localId: "l1" })], "QUOTA_EXCEEDED");
    expect(dispatch).toHaveBeenCalledWith({
      type: "UPDATE_USER_MESSAGE",
      payload: expect.objectContaining({ patch: { status: "failed" } }),
    });
  });

  it("does not offer files again that the server refused", async () => {
    mockPost.mockRejectedValue({ response: { status: 409, data: { data: { code: "ATTACHMENT_NOT_AVAILABLE" } } } });
    const { result, onSendFailed } = setup();

    await act(() => result.current.handleTextSubmit("", [pending()]));

    expect(onSendFailed).toHaveBeenCalledWith([], "ATTACHMENT_NOT_AVAILABLE");
  });

  it("does nothing with neither text nor files", async () => {
    const { result } = setup();
    await act(() => result.current.handleTextSubmit("   ", []));
    expect(mockPost).not.toHaveBeenCalled();
  });
});

describe("attachment copy", () => {
  const keys = (obj: any, prefix = ""): string[] =>
    Object.entries(obj).flatMap(([k, v]) =>
      v && typeof v === "object" ? keys(v, `${prefix}${k}.`) : [`${prefix}${k}`],
    );

  it("exists in Hindi for every English key", () => {
    expect(keys((hi as any).chat.attachments).sort()).toEqual(keys((en as any).chat.attachments).sort());
  });

  it("has a message for every error code the app maps", () => {
    for (const code of ["ATTACHMENT_DAILY_LIMIT", "ATTACHMENT_PROCESSING_FAILED", "AI_UNAVAILABLE"]) {
      expect((en as any).chat.attachments.errors[code]).toBeTruthy();
    }
  });
});
