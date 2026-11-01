import { useCallback, useEffect, useRef, useState } from "react";
import Toast from "react-native-toast-message";
import { t } from "i18next";

import {
  acceptAttachmentConsent,
  deleteAttachment,
  getAttachmentConfig,
  IAttachmentConfig,
  uploadAttachment,
} from "../api/chatAttachments.api";
import { AnalyticsEvent, track } from "../analytics";
import { TAttachmentSource } from "../components/chatAttachments/AttachmentSourceSheet";
import { ChatAction, IPendingAttachment } from "../types/chat.types";
import {
  canAdd,
  errorCodeToI18nKey,
  kindForMime,
  newUuid,
  readyAttachments,
  serverErrorCode,
} from "../utils/attachments";
import { chatLogger } from "../utils/logger";
import { SHEET_DISMISS_MS, TPickedFile, useFilePicker } from "./useFilePicker";

interface UseChatAttachmentsProps {
  /** Viva AI chat only; guided check-ins take no files. */
  enabled: boolean;
  pending: IPendingAttachment[];
  dispatch: React.Dispatch<ChatAction>;
}

export const useChatAttachments = ({ enabled, pending, dispatch }: UseChatAttachmentsProps) => {
  const [config, setConfig] = useState<IAttachmentConfig | null>(null);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [consentVisible, setConsentVisible] = useState(false);
  const [consentSubmitting, setConsentSubmitting] = useState(false);
  const controllers = useRef(new Map<string, AbortController>());
  const pendingRef = useRef(pending);
  pendingRef.current = pending;

  const refreshConfig = useCallback(async () => {
    if (!enabled) return;
    try {
      setConfig(await getAttachmentConfig());
    } catch (error) {
      // No config means no attach button: the feature stays out of the way.
      chatLogger.warn("Attachment config unavailable", error);
      setConfig(null);
    }
  }, [enabled]);

  useEffect(() => {
    refreshConfig();
  }, [refreshConfig]);

  // Abandon in-flight uploads when the screen goes away. Files already uploaded but
  // never sent are deleted by the server's janitor after a day.
  useEffect(() => {
    const inFlight = controllers.current;
    return () => inFlight.forEach(c => c.abort());
  }, []);

  const upload = useCallback(
    async (item: IPendingAttachment) => {
      const controller = new AbortController();
      controllers.current.set(item.localId, controller);
      dispatch({
        type: "UPDATE_PENDING_ATTACHMENT",
        payload: { localId: item.localId, patch: { state: "uploading", progress: 0, errorCode: undefined } },
      });
      try {
        const uploaded = await uploadAttachment(
          {
            uri: item.uri,
            name: item.name || (item.kind === "PDF" ? "report.pdf" : "photo.jpg"),
            type: item.mimeType,
          },
          item.clientUploadId,
          progress =>
            dispatch({
              type: "UPDATE_PENDING_ATTACHMENT",
              payload: { localId: item.localId, patch: { progress } },
            }),
          controller.signal,
        );
        // Removed from the tray while the upload finished: do not keep the file.
        if (!pendingRef.current.some(a => a.localId === item.localId)) {
          deleteAttachment(uploaded.id).catch(() => undefined);
          return;
        }
        dispatch({
          type: "UPDATE_PENDING_ATTACHMENT",
          payload: {
            localId: item.localId,
            patch: {
              state: "uploaded",
              progress: 1,
              serverId: uploaded.id,
              pageCount: uploaded.pageCount,
              sizeBytes: uploaded.sizeBytes,
              width: uploaded.width,
              height: uploaded.height,
            },
          },
        });
        setConfig(prev => (prev ? { ...prev, remainingToday: Math.max(0, prev.remainingToday - 1) } : prev));
      } catch (error: any) {
        if (controller.signal.aborted) return;
        const code = serverErrorCode(error) ?? "GENERIC";
        chatLogger.warn("Attachment upload failed", code);
        track(AnalyticsEvent.CHAT_ATTACHMENT_UPLOAD_FAILED, { code });
        dispatch({
          type: "UPDATE_PENDING_ATTACHMENT",
          payload: { localId: item.localId, patch: { state: "failed", errorCode: code } },
        });
        if (code === "FEATURE_DISABLED") setConfig(prev => (prev ? { ...prev, enabled: false } : prev));
        if (code === "ATTACHMENT_CONSENT_REQUIRED") {
          setConfig(prev => (prev ? { ...prev, consentAccepted: false } : prev));
        }
      } finally {
        controllers.current.delete(item.localId);
      }
    },
    [dispatch],
  );

  const addFiles = useCallback(
    (files: TPickedFile[], source: TAttachmentSource) => {
      if (!config || files.length === 0) return;
      const accepted: IPendingAttachment[] = [];
      for (const file of files) {
        const kind = kindForMime(file.mimeType);
        if (!kind) {
          Toast.show({ type: "error", text1: t(errorCodeToI18nKey("ATTACHMENT_UNSUPPORTED_TYPE")), position: "bottom" });
          continue;
        }
        if (file.sizeBytes && file.sizeBytes > config.maxBytes) {
          Toast.show({ type: "error", text1: t(errorCodeToI18nKey("ATTACHMENT_TOO_LARGE")), position: "bottom" });
          continue;
        }
        const fit = canAdd([...pendingRef.current, ...accepted], kind, 1, config.maxPerTurn);
        if (fit !== "ok") {
          Toast.show({
            type: "info",
            text1: t(errorCodeToI18nKey(fit === "mixed" ? "ATTACHMENT_MIXED_KINDS" : "ATTACHMENT_TOO_MANY")),
            position: "bottom",
          });
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
          width: file.width ?? null,
          height: file.height ?? null,
          state: "uploading",
          progress: 0,
        });
      }
      if (accepted.length === 0) return;
      track(AnalyticsEvent.CHAT_ATTACHMENT_PICKED, {
        source,
        kind: accepted[0].kind === "PDF" ? "pdf" : "image",
        count: accepted.length,
      });
      dispatch({ type: "ADD_PENDING_ATTACHMENTS", payload: accepted });
      accepted.forEach(item => upload(item));
    },
    [config, dispatch, upload],
  );

  const pickFrom = useFilePicker({
    onFiles: addFiles,
    onBeforePick: () => setSheetVisible(false),
    photoRoom: () =>
      (config?.maxPerTurn ?? 3) - pendingRef.current.filter(a => a.kind === "IMAGE").length,
  });

  const openAttach = useCallback(() => {
    if (!config?.enabled) return;
    if (!config.consentAccepted) setConsentVisible(true);
    else setSheetVisible(true);
  }, [config]);

  const acceptConsent = useCallback(async () => {
    if (!config) return;
    setConsentSubmitting(true);
    try {
      await acceptAttachmentConsent(config.consentVersion);
      setConfig({ ...config, consentAccepted: true });
      setConsentVisible(false);
      setTimeout(() => setSheetVisible(true), SHEET_DISMISS_MS);
    } catch (error) {
      // Our text is out of date: fetch the current version and ask again.
      Toast.show({ type: "error", text1: t(errorCodeToI18nKey(serverErrorCode(error))), position: "bottom" });
      refreshConfig();
    } finally {
      setConsentSubmitting(false);
    }
  }, [config, refreshConfig]);

  const remove = useCallback(
    (localId: string) => {
      const item = pendingRef.current.find(a => a.localId === localId);
      controllers.current.get(localId)?.abort();
      dispatch({ type: "REMOVE_PENDING_ATTACHMENT", payload: localId });
      // She took it back before sending: it should not wait a day on the server.
      if (item?.serverId) deleteAttachment(item.serverId).catch(() => undefined);
    },
    [dispatch],
  );

  const retry = useCallback(
    (localId: string) => {
      const item = pendingRef.current.find(a => a.localId === localId);
      if (item && item.state === "failed") upload(item);
    },
    [upload],
  );

  /** Take the ready files for sending; the tray empties. */
  const takeReady = useCallback((): IPendingAttachment[] => {
    const ready = readyAttachments(pendingRef.current);
    dispatch({ type: "SET_PENDING_ATTACHMENTS", payload: [] });
    return ready;
  }, [dispatch]);

  /** Put files back (the send was refused before it started, e.g. no quota left). */
  const restore = useCallback(
    (items: IPendingAttachment[]) => {
      dispatch({ type: "SET_PENDING_ATTACHMENTS", payload: [...items, ...pendingRef.current] });
    },
    [dispatch],
  );

  const hasPdf = pending.some(a => a.kind === "PDF");
  const full = !!config && (hasPdf || pending.length >= config.maxPerTurn);
  return {
    enabled: enabled && !!config?.enabled,
    config,
    sheetVisible,
    closeSheet: () => setSheetVisible(false),
    consentVisible,
    consentSubmitting,
    declineConsent: () => setConsentVisible(false),
    acceptConsent,
    openAttach,
    pickFrom,
    remove,
    retry,
    takeReady,
    restore,
    refreshConfig,
    hasReady: readyAttachments(pending).length > 0,
    /** Sending waits while anything is uploading or failed (retry or remove it first). */
    blocking: pending.some(a => a.state !== "uploaded"),
    full,
    disabledSources: (pending.length === 0
      ? []
      : hasPdf
        ? ["camera", "gallery", "pdf"]
        : ["pdf"]) as TAttachmentSource[],
  };
};
