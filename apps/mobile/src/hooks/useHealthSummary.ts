import { useCallback, useEffect, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Clipboard from "@react-native-clipboard/clipboard";
import Share from "react-native-share";
import Toast from "react-native-toast-message";
import { t } from "i18next";

import { generateHealthSummary, getHealthSummary, getLatestHealthSummary } from "../api/healthRecords.api";
import { AnalyticsEvent, toBucket, track } from "../analytics";
import { IHealthSummary, ILatestHealthSummary } from "../types/healthRecords.types";
import { serverErrorCode } from "../utils/attachments";
import { recordErrorKey } from "../utils/healthRecords";
import { chatLogger } from "../utils/logger";

const CACHE_KEY = "healthSummary:latest:v1";
const POLL_EVERY_MS = 3000;
const POLL_FOR_MS = 2 * 60 * 1000;

/**
 * Drop the cached summary so the next read goes to the server: called when a record
 * is added or deleted, since the summary may then be out of date.
 */
export const invalidateHealthSummaryCache = () => {
  AsyncStorage.removeItem(CACHE_KEY).catch(() => undefined);
};

const readCache = async (): Promise<ILatestHealthSummary | null> => {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as ILatestHealthSummary) : null;
  } catch {
    return null;
  }
};

/**
 * Her latest overall health summary: shown from the device cache at once, refreshed
 * from the server, regenerated on her tap, and shared as plain text.
 */
export const useHealthSummary = ({ autoLoad = true }: { autoLoad?: boolean } = {}) => {
  const [latest, setLatest] = useState<ILatestHealthSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const load = useCallback(async () => {
    try {
      const fresh = await getLatestHealthSummary();
      if (!mounted.current) return fresh;
      setLatest(fresh);
      AsyncStorage.setItem(CACHE_KEY, JSON.stringify(fresh)).catch(() => undefined);
      return fresh;
    } catch (error) {
      chatLogger.warn("Health summary unavailable", serverErrorCode(error));
      return null;
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!autoLoad) return;
    readCache().then(cached => {
      if (cached && mounted.current) {
        setLatest(prev => prev ?? cached);
        setLoading(false);
      }
    });
    load();
  }, [autoLoad, load]);

  const waitFor = useCallback(async (id: string): Promise<IHealthSummary | null> => {
    const started = Date.now();
    while (mounted.current && Date.now() - started < POLL_FOR_MS) {
      await new Promise(r => setTimeout(r, POLL_EVERY_MS));
      try {
        const summary = await getHealthSummary(id);
        if (summary.status !== "PENDING") return summary;
      } catch (error) {
        chatLogger.warn("Polling the health summary failed", serverErrorCode(error));
      }
    }
    return null;
  }, []);

  /** Build a new summary from her records. Resolves once it is ready (or failed). */
  const generate = useCallback(
    async (lang: string): Promise<boolean> => {
      setGenerating(true);
      try {
        const { summary } = await generateHealthSummary(lang);
        const done = summary.status === "PENDING" ? await waitFor(summary.id) : summary;
        await load();
        if (done?.status === "READY") {
          track(AnalyticsEvent.HEALTH_SUMMARY_GENERATED, {
            record_count_bucket: toBucket(done.recordCount, [1, 3, 6, 12]),
          });
          return true;
        }
        Toast.show({ type: "error", text1: t("healthSummary.failed"), position: "bottom" });
        return false;
      } catch (error: any) {
        // 402 opens the paywall from the API client.
        if (error?.response?.status !== 402) {
          Toast.show({ type: "error", text1: t(recordErrorKey(serverErrorCode(error))), position: "bottom" });
        }
        return false;
      } finally {
        if (mounted.current) setGenerating(false);
      }
    },
    [load, waitFor],
  );

  const share = useCallback(async (summary: IHealthSummary | null | undefined) => {
    if (!summary?.shareText) return;
    try {
      const res = await Share.open({
        title: t("healthSummary.shareTitle"),
        message: summary.shareText,
        failOnCancel: false,
      });
      if ((res as any)?.dismissedAction) return;
      track(AnalyticsEvent.SHARE, { content_type: "health_summary", item_id: summary.id });
    } catch (error) {
      chatLogger.warn("Sharing the health summary failed", error);
    }
  }, []);

  const copy = useCallback((summary: IHealthSummary | null | undefined) => {
    if (!summary?.shareText) return;
    Clipboard.setString(summary.shareText);
    Toast.show({ type: "success", text1: t("healthSummary.copied"), position: "bottom" });
    track(AnalyticsEvent.SHARE, { content_type: "health_summary", item_id: summary.id, method: "clipboard" });
  }, []);

  return { latest, loading, generating, load, generate, share, copy };
};
