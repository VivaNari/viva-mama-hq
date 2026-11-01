import { useCallback, useEffect, useRef, useState } from "react";
import Toast from "react-native-toast-message";
import { t } from "i18next";

import {
  acceptHealthRecordsConsent,
  createHealthRecord,
  deleteHealthRecord,
  getHealthRecord,
  getHealthRecordsConfig,
  removeHealthRecordFile,
  retryHealthRecord,
  submitHealthRecord,
  updateHealthRecord,
  uploadHealthRecordFile,
} from "../api/healthRecords.api";
import { AnalyticsEvent, track } from "../analytics";
import type { TAttachmentSource } from "../components/chatAttachments/AttachmentSourceSheet";
import { AttachmentKind } from "../types/chat.types";
import {
  IHealthRecord,
  IHealthRecordsConfig,
  RecordCategory,
  RecordSubjectType,
  ScanType,
} from "../types/healthRecords.types";
import { kindForMime, newUuid, serverErrorCode } from "../utils/attachments";
import { recordErrorKey } from "../utils/healthRecords";
import { chatLogger } from "../utils/logger";
import { invalidateHealthSummaryCache } from "./useHealthSummary";
import { SHEET_DISMISS_MS, TPickedFile, useFilePicker } from "./useFilePicker";

const POLL_EVERY_MS = 3000;
const POLL_FOR_MS = 3 * 60 * 1000;

export type TRecordPage = {
  localId: string;
  clientUploadId: string;
  kind: AttachmentKind;
  uri: string;
  mimeType: string;
  name: string | null;
  sizeBytes: number | null;
  state: "uploading" | "uploaded" | "failed";
  progress: number;
  errorCode?: string;
};

export type TRecordMeta = {
  category: RecordCategory;
  scanType: ScanType | null;
  subject: { type: RecordSubjectType; childId: string | null };
};

export type TDraftPhase = "editing" | "submitting" | "processing" | "done";

const sameMeta = (a: TRecordMeta, b: TRecordMeta) =>
  a.category === b.category &&
  a.scanType === b.scanType &&
  a.subject.type === b.subject.type &&
  a.subject.childId === b.subject.childId;

const toast = (code?: string | null) =>
  Toast.show({ type: "error", text1: t(recordErrorKey(code)), position: "bottom" });

/**
 * One record she is adding: pages upload in the background as soon as she picks
 * them (into a server draft created on the first pick), then "Save" spends one record
 * and waits while Viva reads it.
 */
export const useRecordDraft = (meta: TRecordMeta, lang: string) => {
  const [config, setConfig] = useState<IHealthRecordsConfig | null>(null);
  const [configError, setConfigError] = useState(false);
  const [pages, setPages] = useState<TRecordPage[]>([]);
  const [phase, setPhase] = useState<TDraftPhase>("editing");
  const [record, setRecord] = useState<IHealthRecord | null>(null);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [consentVisible, setConsentVisible] = useState(false);
  const [consentSubmitting, setConsentSubmitting] = useState(false);

  const draftKey = useRef(newUuid());
  const draft = useRef<{ id: string; meta: TRecordMeta } | null>(null);
  const creating = useRef<Promise<string> | null>(null);
  const submitted = useRef(false);
  const controllers = useRef(new Map<string, AbortController>());
  const pagesRef = useRef(pages);
  pagesRef.current = pages;
  const metaRef = useRef(meta);
  metaRef.current = meta;
  const mounted = useRef(true);

  const refreshConfig = useCallback(async () => {
    try {
      setConfig(await getHealthRecordsConfig());
      setConfigError(false);
    } catch (error) {
      chatLogger.warn("Health records config unavailable", error);
      setConfigError(true);
    }
  }, []);

  useEffect(() => {
    refreshConfig();
  }, [refreshConfig]);

  // Leaving with pages uploaded but never saved: drop the draft now rather than leave
  // her files on the server for the janitor.
  useEffect(() => {
    mounted.current = true;
    const inFlight = controllers.current;
    return () => {
      mounted.current = false;
      inFlight.forEach(c => c.abort());
      if (draft.current && !submitted.current) {
        deleteHealthRecord(draft.current.id).catch(() => undefined);
      }
    };
  }, []);

  const patchPage = useCallback((localId: string, patch: Partial<TRecordPage>) => {
    setPages(prev => prev.map(p => (p.localId === localId ? { ...p, ...patch } : p)));
  }, []);

  const ensureDraft = useCallback((): Promise<string> => {
    if (draft.current) return Promise.resolve(draft.current.id);
    if (!creating.current) {
      const startMeta = metaRef.current;
      creating.current = createHealthRecord({
        clientUploadId: draftKey.current,
        category: startMeta.category,
        scanType: startMeta.scanType,
        subject: startMeta.subject,
      })
        .then(created => {
          draft.current = { id: created.id, meta: startMeta };
          return created.id;
        })
        .finally(() => {
          creating.current = null;
        });
    }
    return creating.current;
  }, []);

  const upload = useCallback(
    async (page: TRecordPage) => {
      const controller = new AbortController();
      controllers.current.set(page.localId, controller);
      patchPage(page.localId, { state: "uploading", progress: 0, errorCode: undefined });
      try {
        const recordId = await ensureDraft();
        await uploadHealthRecordFile(
          recordId,
          {
            uri: page.uri,
            name: page.name || (page.kind === "PDF" ? "report.pdf" : "page.jpg"),
            type: page.mimeType,
          },
          page.clientUploadId,
          progress => patchPage(page.localId, { progress }),
          controller.signal,
        );
        // Removed while the upload finished: take it off the draft too.
        if (!pagesRef.current.some(p => p.localId === page.localId)) {
          removeHealthRecordFile(recordId, page.clientUploadId).catch(() => undefined);
          return;
        }
        patchPage(page.localId, { state: "uploaded", progress: 1 });
      } catch (error) {
        if (controller.signal.aborted) return;
        const code = serverErrorCode(error) ?? "GENERIC";
        chatLogger.warn("Record page upload failed", code);
        patchPage(page.localId, { state: "failed", errorCode: code });
        if (code === "HEALTH_RECORDS_CONSENT_REQUIRED") {
          setConfig(prev => (prev ? { ...prev, consentAccepted: false } : prev));
        }
      } finally {
        controllers.current.delete(page.localId);
      }
    },
    [ensureDraft, patchPage],
  );

  const addFiles = useCallback(
    (files: TPickedFile[], source: TAttachmentSource) => {
      if (!config) return;
      const accepted: TRecordPage[] = [];
      for (const file of files) {
        const kind = kindForMime(file.mimeType);
        if (!kind) {
          toast("ATTACHMENT_UNSUPPORTED_TYPE");
          continue;
        }
        if (file.sizeBytes && file.sizeBytes > config.maxBytes) {
          toast("ATTACHMENT_TOO_LARGE");
          continue;
        }
        const all = [...pagesRef.current, ...accepted];
        if ((kind === "PDF" && all.length > 0) || all.some(p => p.kind === "PDF")) {
          toast("HEALTH_RECORD_MIXED_KINDS");
          break;
        }
        if (all.length >= config.maxFiles) {
          toast("HEALTH_RECORD_TOO_MANY_FILES");
          break;
        }
        accepted.push({
          localId: newUuid(),
          clientUploadId: newUuid(),
          kind,
          uri: file.uri,
          mimeType: kind === "IMAGE" && /heic|heif/i.test(file.mimeType) ? "image/jpeg" : file.mimeType,
          name: kind === "PDF" ? file.name : null,
          sizeBytes: file.sizeBytes,
          state: "uploading",
          progress: 0,
        });
      }
      if (accepted.length === 0) return;
      track(AnalyticsEvent.RECORD_UPLOAD_STARTED, {
        category: metaRef.current.category,
        source,
        file_count: accepted.length,
      });
      setPages(prev => [...prev, ...accepted]);
      accepted.forEach(page => upload(page));
    },
    [config, upload],
  );

  const pickFrom = useFilePicker({
    onFiles: addFiles,
    onBeforePick: () => setSheetVisible(false),
    photoRoom: () => (config?.maxFiles ?? 5) - pagesRef.current.length,
  });

  const openAdd = useCallback(() => {
    if (!config?.enabled) return;
    if (!config.consentAccepted) setConsentVisible(true);
    else setSheetVisible(true);
  }, [config]);

  const acceptConsent = useCallback(async () => {
    if (!config) return;
    setConsentSubmitting(true);
    try {
      await acceptHealthRecordsConsent(config.consentVersion);
      setConfig({ ...config, consentAccepted: true });
      setConsentVisible(false);
      setTimeout(() => setSheetVisible(true), SHEET_DISMISS_MS);
    } catch (error) {
      toast(serverErrorCode(error));
      refreshConfig();
    } finally {
      setConsentSubmitting(false);
    }
  }, [config, refreshConfig]);

  const remove = useCallback((localId: string) => {
    const page = pagesRef.current.find(p => p.localId === localId);
    controllers.current.get(localId)?.abort();
    setPages(prev => prev.filter(p => p.localId !== localId));
    if (page?.state === "uploaded" && draft.current) {
      removeHealthRecordFile(draft.current.id, page.clientUploadId).catch(() => undefined);
    }
  }, []);

  const retry = useCallback(
    (localId: string) => {
      const page = pagesRef.current.find(p => p.localId === localId);
      if (page && page.state === "failed") upload(page);
    },
    [upload],
  );

  /** Poll until Viva has read it (or give up waiting; it stays in My records). */
  const waitForResult = useCallback(async (recordId: string) => {
    const started = Date.now();
    while (mounted.current && Date.now() - started < POLL_FOR_MS) {
      await new Promise(r => setTimeout(r, POLL_EVERY_MS));
      if (!mounted.current) return;
      try {
        const latest = await getHealthRecord(recordId);
        if (latest.status !== "PROCESSING") {
          setRecord(latest);
          setPhase("done");
          track(AnalyticsEvent.RECORD_SAVED, { category: latest.category, verdict: latest.status });
          if (latest.status === "READY") invalidateHealthSummaryCache();
          return;
        }
      } catch (error) {
        chatLogger.warn("Polling a record failed", serverErrorCode(error));
      }
    }
    if (mounted.current) setPhase("done");
  }, []);

  const submit = useCallback(async () => {
    const recordId = draft.current?.id;
    if (!recordId || phase !== "editing") return;
    setPhase("submitting");
    try {
      // What it is, or who it is for, changed after the first page was picked.
      if (!sameMeta(draft.current!.meta, metaRef.current)) {
        await updateHealthRecord(recordId, metaRef.current);
        draft.current = { id: recordId, meta: metaRef.current };
      }
      const { record: started } = await submitHealthRecord(recordId, lang);
      submitted.current = true;
      setRecord(started);
      setPhase("processing");
      setConfig(prev =>
        prev
          ? {
              ...prev,
              quota: {
                ...prev.quota,
                uploads: {
                  ...prev.quota.uploads,
                  remaining:
                    prev.quota.uploads.remaining == null ? null : Math.max(0, prev.quota.uploads.remaining - 1),
                },
              },
            }
          : prev,
      );
      waitForResult(recordId);
    } catch (error: any) {
      setPhase("editing");
      // 402 opens the paywall from the API client; a toast on top would be noise.
      if (error?.response?.status !== 402) toast(serverErrorCode(error));
    }
  }, [phase, lang, waitForResult]);

  const retryRead = useCallback(async () => {
    if (!record) return;
    setPhase("processing");
    try {
      const { record: started } = await retryHealthRecord(record.id);
      setRecord(started);
      waitForResult(record.id);
    } catch (error: any) {
      setPhase("done");
      if (error?.response?.status !== 402) toast(serverErrorCode(error));
    }
  }, [record, waitForResult]);

  /** Start over for another record. */
  const reset = useCallback(() => {
    controllers.current.forEach(c => c.abort());
    if (draft.current && !submitted.current) {
      deleteHealthRecord(draft.current.id).catch(() => undefined);
    }
    draftKey.current = newUuid();
    draft.current = null;
    submitted.current = false;
    setPages([]);
    setRecord(null);
    setPhase("editing");
    refreshConfig();
  }, [refreshConfig]);

  const uploaded = pages.filter(p => p.state === "uploaded").length;
  return {
    config,
    configError,
    refreshConfig,
    pages,
    phase,
    record,
    sheetVisible,
    closeSheet: () => setSheetVisible(false),
    consentVisible,
    consentSubmitting,
    declineConsent: () => setConsentVisible(false),
    acceptConsent,
    openAdd,
    pickFrom,
    remove,
    retry,
    submit,
    retryRead,
    reset,
    /** Saving waits until every page is up (retry or remove a failed one first). */
    canSubmit: phase === "editing" && uploaded > 0 && uploaded === pages.length && !!draft.current,
    full: !!config && (pages.some(p => p.kind === "PDF") || pages.length >= config.maxFiles),
    disabledSources: (pages.length === 0
      ? []
      : pages.some(p => p.kind === "PDF")
        ? ["camera", "gallery", "pdf"]
        : ["pdf"]) as TAttachmentSource[],
  };
};
