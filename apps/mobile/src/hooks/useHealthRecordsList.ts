import { useCallback, useRef, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import Toast from "react-native-toast-message";
import { t } from "i18next";

import { deleteHealthRecords, listHealthRecords } from "../api/healthRecords.api";
import { AnalyticsEvent, toBucket, track } from "../analytics";
import { IHealthRecordItem, IRecordGroup, RecordCategory, RecordSubjectType } from "../types/healthRecords.types";
import { serverErrorCode } from "../utils/attachments";
import { mergeGroups, withoutRecords } from "../utils/healthRecords";
import { chatLogger } from "../utils/logger";
import { invalidateHealthSummaryCache } from "./useHealthSummary";

export type TRecordFilter = {
  subject?: RecordSubjectType;
  childId?: string;
  category?: RecordCategory;
};

const POLL_PROCESSING_MS = 5000;

/**
 * Her records, page by page, newest report first. Refreshed on focus; while any is
 * still being read, refreshed every few seconds so its card turns ready by itself.
 */
export const useHealthRecordsList = (filter: TRecordFilter) => {
  const [groups, setGroups] = useState<IRecordGroup[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [readyRecords, setReadyRecords] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(false);
  const groupsRef = useRef(groups);
  groupsRef.current = groups;
  const filterKey = JSON.stringify(filter);

  const fetchFirst = useCallback(async () => {
    try {
      const page = await listHealthRecords({ ...JSON.parse(filterKey), limit: 20 });
      setGroups(page.groups);
      setNextCursor(page.nextCursor);
      setReadyRecords(page.readyRecords);
      setError(false);
      return page.groups;
    } catch (e) {
      chatLogger.warn("Loading records failed", serverErrorCode(e));
      setError(true);
      return null;
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filterKey]);

  useFocusEffect(
    useCallback(() => {
      let timer: ReturnType<typeof setTimeout> | null = null;
      let active = true;
      const tick = async () => {
        const latest = await fetchFirst();
        const processing = latest?.some(g => g.records.some(r => r.status === "PROCESSING"));
        if (active && processing) timer = setTimeout(tick, POLL_PROCESSING_MS);
      };
      tick();
      return () => {
        active = false;
        if (timer) clearTimeout(timer);
      };
    }, [fetchFirst]),
  );

  const refresh = useCallback(() => {
    setRefreshing(true);
    fetchFirst();
  }, [fetchFirst]);

  const loadMore = useCallback(async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await listHealthRecords({ ...JSON.parse(filterKey), cursor: nextCursor, limit: 20 });
      setGroups(prev => mergeGroups(prev, page.groups));
      setNextCursor(page.nextCursor);
    } catch (e) {
      chatLogger.warn("Loading more records failed", serverErrorCode(e));
    } finally {
      setLoadingMore(false);
    }
  }, [nextCursor, loadingMore, filterKey]);

  /** Delete for good, removing the cards at once and putting them back if it fails. */
  const remove = useCallback(async (records: IHealthRecordItem[]): Promise<boolean> => {
    if (records.length === 0) return false;
    const ids = records.map(r => r.id);
    const before = groupsRef.current;
    setGroups(withoutRecords(before, ids));
    try {
      await deleteHealthRecords(ids);
      const readyGone = records.filter(r => r.status === "READY").length;
      setReadyRecords(n => Math.max(0, n - readyGone));
      invalidateHealthSummaryCache();
      track(AnalyticsEvent.RECORD_DELETED, {
        count_bucket: toBucket(ids.length, [1, 3, 10, 25]),
        status: records.length === 1 ? records[0].status : "MIXED",
      });
      return true;
    } catch (e) {
      chatLogger.warn("Deleting records failed", serverErrorCode(e));
      setGroups(before);
      Toast.show({ type: "error", text1: t("healthRecords.deleteFailed"), position: "bottom" });
      return false;
    }
  }, []);

  /** Swap in a record changed elsewhere (date edited in the summary sheet). */
  const replace = useCallback(() => fetchFirst(), [fetchFirst]);

  return {
    groups,
    readyRecords,
    loading,
    refreshing,
    loadingMore,
    error,
    hasMore: !!nextCursor,
    refresh,
    loadMore,
    remove,
    replace,
  };
};
