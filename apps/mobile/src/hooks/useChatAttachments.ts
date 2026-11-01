import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Linking } from "react-native";
import { launchCamera, launchImageLibrary, Asset, ImagePickerResponse } from "react-native-image-picker";
import {
  errorCodes,
  isErrorWithCode,
  keepLocalCopy,
  pick,
  types as documentTypes,
} from "@react-native-documents/picker";
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

/**
 * Picker output, resized on the device: long edge 2048 px, JPEG 0.8. That keeps a
 * phone photo of a report around 0.5-1.5 MB (fast on 3G) while the small print stays
 * readable, and `compatible` makes iOS hand over JPEG instead of HEIC. The server
 * re-encodes and strips metadata again regardless.
 */
const PHOTO_OPTIONS = {
  mediaType: "photo" as const,
  maxWidth: 2048,
  maxHeight: 2048,
  quality: 0.8 as const,
  includeExtra: false,
  includeBase64: false,
  assetRepresentationMode: "compatible" as const,
};

/** iOS cannot present a picker while our sheet is still animating away. */
const SHEET_DISMISS_MS = 350;

type TPickedFile = {
  uri: string;
  name: string;
  mimeType: string;
  sizeBytes: number | null;
  width?: number | null;
  height?: number | null;
};

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

  const fromImagePicker = useCallback(
    (response: ImagePickerResponse, source: TAttachmentSource) => {
      if (response.didCancel) return;
      if (response.errorCode) {
        if (response.errorCode === "permission") {
          Alert.alert(t("chat.attachments.takePhoto"), t("chat.attachments.cameraPermission"), [
            { text: t("common.cancel"), style: "cancel" },
            { text: t("chat.attachments.openSettings"), onPress: () => Linking.openSettings() },
          ]);
        } else if (response.errorCode === "camera_unavailable") {
          Toast.show({ type: "error", text1: t("chat.attachments.cameraUnavailable"), position: "bottom" });
        } else {
          Toast.show({ type: "error", text1: t(errorCodeToI18nKey("GENERIC")), position: "bottom" });
        }
        return;
      }
      const files = (response.assets ?? [])
        .filter((a: Asset) => !!a.uri)
        .map((a: Asset) => ({
          uri: a.uri as string,
          name: a.fileName || "photo.jpg",
          mimeType: a.type || "image/jpeg",
          sizeBytes: a.fileSize ?? null,
          width: a.width ?? null,
          height: a.height ?? null,
        }));
      addFiles(files, source);
    },
    [addFiles],
  );

  const pickFrom = useCallback(
    (source: TAttachmentSource) => {
      setSheetVisible(false);
      const imagesSoFar = pendingRef.current.filter(a => a.kind === "IMAGE").length;
      const room = Math.max(1, (config?.maxPerTurn ?? 3) - imagesSoFar);
      setTimeout(async () => {
        try {
          if (source === "camera") {
            fromImagePicker(
              await launchCamera({ ...PHOTO_OPTIONS, saveToPhotos: false, cameraType: "back" }),
              source,
            );
          } else if (source === "gallery") {
            // The Android Photo Picker on 13+ (backported below that): no storage
            // permission, which the app deliberately does not hold.
            fromImagePicker(await launchImageLibrary({ ...PHOTO_OPTIONS, selectionLimit: room }), source);
          } else {
            const [file] = await pick({ type: [documentTypes.pdf], allowMultiSelection: false });
            // A content:// URI can stop being readable once the picker returns; copy
            // it into our cache first so the upload (and a retry) can read it.
            const [copy] = await keepLocalCopy({
              files: [{ uri: file.uri, fileName: file.name ?? "report.pdf" }],
              destination: "cachesDirectory",
            });
            if (copy.status !== "success") throw new Error("copy failed");
            addFiles(
              [
                {
                  uri: copy.localUri,
                  name: file.name ?? "report.pdf",
                  mimeType: file.type ?? "application/pdf",
                  sizeBytes: file.size ?? null,
                },
              ],
              source,
            );
          }
        } catch (error) {
          if (isErrorWithCode(error) && error.code === errorCodes.OPERATION_CANCELED) return;
          chatLogger.error("Attachment pick failed", error);
          Toast.show({ type: "error", text1: t(errorCodeToI18nKey("GENERIC")), position: "bottom" });
        }
      }, SHEET_DISMISS_MS);
    },
    [config, fromImagePicker, addFiles],
  );

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
