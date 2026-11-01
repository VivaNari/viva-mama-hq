/**
 * Health records: adding a record (pages, limits, save, waiting for Viva), the list
 * helpers, the Dashboard card, sharing the summary, and en/hi parity of the copy.
 */
import React from "react";
import { act, fireEvent, render, renderHook, waitFor } from "@testing-library/react-native";

const mockApi = {
  getHealthRecordsConfig: jest.fn(),
  acceptHealthRecordsConsent: jest.fn(),
  createHealthRecord: jest.fn(),
  uploadHealthRecordFile: jest.fn(),
  removeHealthRecordFile: jest.fn(),
  submitHealthRecord: jest.fn(),
  retryHealthRecord: jest.fn(),
  getHealthRecord: jest.fn(),
  updateHealthRecord: jest.fn(),
  deleteHealthRecord: jest.fn(),
  getLatestHealthSummary: jest.fn(),
  generateHealthSummary: jest.fn(),
  getHealthSummary: jest.fn(),
};
// Resolved per call: the factory runs before `mockApi` is initialised.
jest.mock("../src/api/healthRecords.api", () =>
  new Proxy(
    { __esModule: true },
    { get: (target: any, key: string) => (key in target ? target[key] : (...a: any[]) => (mockApi as any)[key](...a)) },
  ),
);

jest.mock("@react-native-vector-icons/lucide", () => {
  const React = require("react");
  const Icon = (props: any) => React.createElement("Icon", props);
  return { __esModule: true, default: Icon, Lucide: Icon };
});

jest.mock("../src/analytics", () => ({
  AnalyticsEvent: new Proxy({}, { get: (_t, key) => key }),
  track: jest.fn(),
  toBucket: () => "xs",
  lengthBucket: () => "xs",
  byteSizeBucket: () => "s",
  recordError: jest.fn(),
}));

const mockShareOpen = jest.fn().mockResolvedValue({});
jest.mock("react-native-share", () => ({ __esModule: true, default: { open: (...a: any[]) => mockShareOpen(...a) } }));
jest.mock("@react-native-clipboard/clipboard", () => ({ __esModule: true, default: { setString: jest.fn() } }));

const mockNavigate = jest.fn();
jest.mock("@react-navigation/native", () => {
  const actual = jest.requireActual("@react-navigation/native");
  const React = require("react");
  return {
    ...actual,
    useNavigation: () => ({ navigate: mockNavigate, goBack: jest.fn() }),
    useFocusEffect: (cb: () => void) => React.useEffect(cb, [cb]),
  };
});

import HealthSummaryCard from "../src/components/dashboard/HealthSummaryCard";
import { useHealthSummary } from "../src/hooks/useHealthSummary";
import { TRecordMeta, useRecordDraft } from "../src/hooks/useRecordDraft";
import en from "../src/i18n/locales/en.json";
import hi from "../src/i18n/locales/hi.json";
import { IRecordGroup } from "../src/types/healthRecords.types";
import {
  mergeGroups,
  recordErrorKey,
  toMonthSections,
  toRecordsLang,
  withoutRecords,
} from "../src/utils/healthRecords";

const CONFIG = {
  enabled: true,
  maxFiles: 5,
  maxBytes: 10 * 1024 * 1024,
  maxPdfPages: 20,
  acceptedMimeTypes: [],
  consentVersion: "v1",
  consentAccepted: true,
  quota: { uploads: { used: 0, limit: 5, remaining: 5 }, summaries: { used: 0, limit: 1, remaining: 1 } },
};
const META: TRecordMeta = { category: "lab", scanType: null, subject: { type: "MOTHER", childId: null } };
const photo = (n = 1) => ({ uri: `file:///p${n}.jpg`, name: `p${n}.jpg`, mimeType: "image/jpeg", sizeBytes: 500_000 });
const pdf = () => ({ uri: "file:///r.pdf", name: "r.pdf", mimeType: "application/pdf", sizeBytes: 900_000 });

beforeEach(() => {
  jest.clearAllMocks();
  mockApi.getHealthRecordsConfig.mockResolvedValue(CONFIG);
  mockApi.createHealthRecord.mockResolvedValue({ id: "rec1" });
  mockApi.uploadHealthRecordFile.mockResolvedValue({ file: { id: "f" }, previewUrl: null });
  mockApi.deleteHealthRecord.mockResolvedValue(undefined);
});

// The picker hook is tested through what it hands over: call its onFiles directly.
jest.mock("../src/hooks/useFilePicker", () => {
  const actual = jest.requireActual("../src/hooks/useFilePicker");
  return {
    ...actual,
    useFilePicker: (props: any) => {
      (global as any).__pick = props.onFiles;
      return jest.fn();
    },
  };
});
const pick = (files: any[], source = "gallery") => act(() => (global as any).__pick(files, source));

describe("useRecordDraft", () => {
  const setup = async () => {
    const hook = renderHook(() => useRecordDraft(META, "en"));
    await waitFor(() => expect(hook.result.current.config).not.toBeNull());
    return hook;
  };

  it("creates one draft, uploads every page into it, and saves once all are up", async () => {
    const { result } = await setup();
    await pick([photo(1), photo(2)]);
    await waitFor(() => expect(result.current.pages.every(p => p.state === "uploaded")).toBe(true));

    expect(mockApi.createHealthRecord).toHaveBeenCalledTimes(1);
    expect(mockApi.createHealthRecord.mock.calls[0][0]).toMatchObject({ category: "lab", subject: { type: "MOTHER" } });
    expect(mockApi.uploadHealthRecordFile).toHaveBeenCalledTimes(2);
    expect(mockApi.uploadHealthRecordFile.mock.calls.every((c: any[]) => c[0] === "rec1")).toBe(true);
    expect(result.current.canSubmit).toBe(true);
  });

  it("keeps a record to 5 photos, or one PDF on its own", async () => {
    const { result } = await setup();
    await pick([1, 2, 3, 4, 5, 6].map(photo));
    expect(result.current.pages).toHaveLength(5);
    expect(result.current.full).toBe(true);
    await pick([pdf()], "pdf");
    expect(result.current.pages.every(p => p.kind === "IMAGE")).toBe(true);
  });

  it("refuses a file over the size limit before uploading it", async () => {
    const { result } = await setup();
    await pick([{ ...photo(), sizeBytes: 11 * 1024 * 1024 }]);
    expect(result.current.pages).toHaveLength(0);
    expect(mockApi.createHealthRecord).not.toHaveBeenCalled();
  });

  it("asks for consent before the first pick", async () => {
    mockApi.getHealthRecordsConfig.mockResolvedValue({ ...CONFIG, consentAccepted: false });
    const { result } = await setup();
    act(() => result.current.openAdd());
    expect(result.current.consentVisible).toBe(true);
    expect(result.current.sheetVisible).toBe(false);
  });

  it("submits, then waits until Viva has read it", async () => {
    jest.useFakeTimers();
    try {
      const { result } = await setup();
      await pick([photo()]);
      await waitFor(() => expect(result.current.canSubmit).toBe(true));
      mockApi.submitHealthRecord.mockResolvedValue({ record: { id: "rec1", status: "PROCESSING" }, quota: {} });
      mockApi.getHealthRecord
        .mockResolvedValueOnce({ id: "rec1", status: "PROCESSING" })
        .mockResolvedValueOnce({ id: "rec1", status: "READY", category: "lab", summary: { markdown: "ok" } });

      await act(() => result.current.submit());
      expect(result.current.phase).toBe("processing");
      expect(mockApi.submitHealthRecord).toHaveBeenCalledWith("rec1", "en");

      await act(async () => {
        await jest.advanceTimersByTimeAsync(3100);
      });
      await act(async () => {
        await jest.advanceTimersByTimeAsync(3100);
      });
      expect(result.current.phase).toBe("done");
      expect(result.current.record?.status).toBe("READY");
    } finally {
      jest.useRealTimers();
    }
  });

  it("sends a changed 'who is this for' before saving", async () => {
    let meta = META;
    const { result, rerender } = renderHook(() => useRecordDraft(meta, "en"));
    await waitFor(() => expect(result.current.config).not.toBeNull());
    await pick([photo()]);
    await waitFor(() => expect(result.current.canSubmit).toBe(true));
    meta = { ...META, subject: { type: "CHILD", childId: "c1" } };
    rerender({});
    mockApi.submitHealthRecord.mockResolvedValue({ record: { id: "rec1", status: "PROCESSING" }, quota: {} });
    await act(() => result.current.submit());
    expect(mockApi.updateHealthRecord).toHaveBeenCalledWith("rec1", meta);
  });

  it("drops an unsaved draft when she leaves", async () => {
    const { result, unmount } = await setup();
    await pick([photo()]);
    await waitFor(() => expect(result.current.canSubmit).toBe(true));
    unmount();
    expect(mockApi.deleteHealthRecord).toHaveBeenCalledWith("rec1");
  });
});

describe("list helpers", () => {
  const item = (id: string, date: string) => ({ id, recordDate: date }) as any;
  const groups: IRecordGroup[] = [
    { date: "2026-11-03", records: [item("a", "2026-11-03")] },
    { date: "2026-10-20", records: [item("b", "2026-10-20")] },
  ];

  it("joins a day split across two pages", () => {
    const merged = mergeGroups(groups, [
      { date: "2026-10-20", records: [item("c", "2026-10-20")] },
      { date: "2026-09-01", records: [item("d", "2026-09-01")] },
    ]);
    expect(merged.map(g => [g.date, g.records.map(r => r.id)])).toEqual([
      ["2026-11-03", ["a"]],
      ["2026-10-20", ["b", "c"]],
      ["2026-09-01", ["d"]],
    ]);
  });

  it("removes deleted records and any day left empty", () => {
    expect(withoutRecords(groups, ["a"]).map(g => g.date)).toEqual(["2026-10-20"]);
  });

  it("groups days under their month", () => {
    const sections = toMonthSections(groups, "en");
    expect(sections.map(s => s.key)).toEqual(["2026-11", "2026-10"]);
    expect(sections[0].title).toContain("2026");
  });

  it("maps record codes to their copy and page checks to the chat copy", () => {
    expect(recordErrorKey("HEALTH_RECORD_TOO_MANY_FILES")).toBe("healthRecords.errors.HEALTH_RECORD_TOO_MANY_FILES");
    expect(recordErrorKey("ATTACHMENT_TOO_LARGE")).toBe("chat.attachments.errors.ATTACHMENT_TOO_LARGE");
    expect(recordErrorKey(undefined)).toBe("chat.attachments.errors.GENERIC");
  });

  it("reads languages the way the server expects", () => {
    expect(toRecordsLang("hi-IN")).toBe("hi");
    expect(toRecordsLang("en-GB")).toBe("en");
  });
});

const SUMMARY = {
  id: "s1",
  status: "READY",
  lang: "en",
  recordCount: 3,
  createdAt: "2026-11-01T10:00:00.000Z",
  errorCode: null,
  shareText: "VivaMama health summary — Asha",
  content: {
    overview: "My haemoglobin was below the range in June.",
    values_to_discuss: [{ name: "Haemoglobin" }],
    facts: {},
  },
};

// The card's first render can take seconds on a loaded machine; its waits allow for it.
describe("health summary", () => {
  it("shares the plain text the server built", async () => {
    mockApi.getLatestHealthSummary.mockResolvedValue({ summary: SUMMARY, stale: null, pending: null, readyRecords: 3 });
    const { result } = renderHook(() => useHealthSummary());
    await waitFor(() => expect(result.current.latest?.summary?.id).toBe("s1"));
    await act(() => result.current.share(result.current.latest!.summary));
    expect(mockShareOpen).toHaveBeenCalledWith(
      expect.objectContaining({ message: "VivaMama health summary — Asha" }),
    );
  });

  it("dashboard card invites her to add a record when she has none", async () => {
    mockApi.getLatestHealthSummary.mockResolvedValue({ summary: null, stale: null, pending: null, readyRecords: 0 });
    const screen = render(<HealthSummaryCard />);
    await waitFor(() => screen.getByText(en.healthRecords.addRecord), { timeout: 5000 });
    fireEvent.press(screen.getByText(en.healthRecords.addRecord));
    expect(mockNavigate).toHaveBeenCalledWith("RecordsUpload", undefined);
  });

  it("dashboard card shows the latest summary, flags it out of date, and shares it", async () => {
    mockApi.getLatestHealthSummary.mockResolvedValue({
      summary: SUMMARY,
      stale: { newRecords: 1, removedRecords: 0 },
      pending: null,
      readyRecords: 4,
    });
    const screen = render(<HealthSummaryCard />);
    await waitFor(() => screen.getByText(SUMMARY.content.overview), { timeout: 5000 });
    expect(screen.getByText(en.healthSummary.outOfDate)).toBeTruthy();
    fireEvent.press(screen.getByLabelText(en.healthSummary.share));
    await waitFor(() => expect(mockShareOpen).toHaveBeenCalled());
  });

  it("dashboard card stays hidden while records are switched off", async () => {
    mockApi.getHealthRecordsConfig.mockResolvedValue({ ...CONFIG, enabled: false });
    mockApi.getLatestHealthSummary.mockResolvedValue({ summary: null, stale: null, pending: null, readyRecords: 0 });
    const screen = render(<HealthSummaryCard />);
    await waitFor(() => expect(mockApi.getHealthRecordsConfig).toHaveBeenCalled());
    expect(screen.queryByText(en.healthSummary.cardTitle)).toBeNull();
  });
});

describe("copy", () => {
  const keys = (obj: any, prefix = ""): string[] =>
    Object.entries(obj).flatMap(([k, v]) => (typeof v === "object" ? keys(v, `${prefix}${k}.`) : [`${prefix}${k}`]));

  it.each(["healthRecords", "healthSummary"] as const)("%s has the same keys in en and hi", ns => {
    expect(keys((hi as any)[ns]).sort()).toEqual(keys((en as any)[ns]).sort());
  });
});
