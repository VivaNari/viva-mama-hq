import { useCallback } from "react";
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

import type { TAttachmentSource } from "../components/chatAttachments/AttachmentSourceSheet";
import { errorCodeToI18nKey } from "../utils/attachments";
import { chatLogger } from "../utils/logger";

/**
 * Picker output, resized on the device: long edge 2048 px, JPEG 0.8. That keeps a
 * phone photo of a report around 0.5-1.5 MB (fast on 3G) while the small print stays
 * readable, and `compatible` makes iOS hand over JPEG instead of HEIC. The server
 * re-encodes and strips metadata again regardless.
 */
export const PHOTO_OPTIONS = {
  mediaType: "photo" as const,
  maxWidth: 2048,
  maxHeight: 2048,
  quality: 0.8 as const,
  includeExtra: false,
  includeBase64: false,
  assetRepresentationMode: "compatible" as const,
};

/** iOS cannot present a picker while our sheet is still animating away. */
export const SHEET_DISMISS_MS = 350;

export type TPickedFile = {
  uri: string;
  name: string;
  mimeType: string;
  sizeBytes: number | null;
  width?: number | null;
  height?: number | null;
};

interface UseFilePickerProps {
  /** Called with what she picked (never with nothing; a cancel does nothing). */
  onFiles: (files: TPickedFile[], source: TAttachmentSource) => void;
  /** How many photos the gallery may return this time. */
  photoRoom: () => number;
  /** Called first, to close the sheet the picker was opened from. */
  onBeforePick?: () => void;
}

/**
 * Camera, gallery (the Android Photo Picker: no storage permission) or a PDF, shared
 * by chat attachments and health records.
 */
export const useFilePicker = ({ onFiles, photoRoom, onBeforePick }: UseFilePickerProps) => {
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
      if (files.length) onFiles(files, source);
    },
    [onFiles],
  );

  return useCallback(
    (source: TAttachmentSource) => {
      onBeforePick?.();
      const room = Math.max(1, photoRoom());
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
            onFiles(
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
          chatLogger.error("File pick failed", error);
          Toast.show({ type: "error", text1: t(errorCodeToI18nKey("GENERIC")), position: "bottom" });
        }
      }, SHEET_DISMISS_MS);
    },
    [fromImagePicker, onFiles, photoRoom, onBeforePick],
  );
};
