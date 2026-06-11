import RNDateTimePicker, {
  DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { Lucide } from '@react-native-vector-icons/lucide';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { deleteMoodLog, getMoodLogs, upsertMoodLog } from '../api/moodLog.api';
import MoodDateStrip from '../components/mood/MoodDateStrip';
import MoodFaceSelector from '../components/mood/MoodFaceSelector';
import { useAuth } from '../context/AuthContext';
import { chatDB } from '../db/sqlite';
import { getMoodOption } from '../data/moodData';
import { colors } from '../public/assets/colors';
import { globalStyles } from '../public/styles';
import { moodLogStyles as styles } from '../public/styles/moodLogStyles';
import { EMood } from '../types/moodLog.types';
import { startOfDay, toISODateKey } from '../utils/dateKey';

// Fallback window if the user's join date can't be resolved locally.
const FALLBACK_DAYS_BACK = 60;

const buildDateRange = (from: Date, to: Date): Date[] => {
  const dates: Date[] = [];
  const cursor = startOfDay(from);
  const end = startOfDay(to);
  while (cursor <= end) {
    dates.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
};

const MoodLog: React.FC = () => {
  const { userId } = useAuth();

  const today = useMemo(() => startOfDay(new Date()), []);
  const [joinDate, setJoinDate] = useState<Date>(() => {
    const d = new Date();
    d.setDate(d.getDate() - FALLBACK_DAYS_BACK);
    return startOfDay(d);
  });

  const [moodByDate, setMoodByDate] = useState<Map<string, EMood>>(new Map());
  const [selectedDate, setSelectedDate] = useState<Date>(today);
  const [selectedMood, setSelectedMood] = useState<EMood | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showPicker, setShowPicker] = useState(false);

  const busy = saving || deleting;

  // Resolve the join date (onboarding date, then account creation) from cache.
  useEffect(() => {
    (async () => {
      if (!userId) return;
      try {
        const stored: any = await chatDB.getUserData(userId);
        const user = stored?.data?.user ?? stored?.user ?? stored;
        const joined =
          user?.onboarding_data?.onboarded_at ?? user?.createdAt ?? null;
        if (joined) setJoinDate(startOfDay(new Date(joined)));
      } catch (e) {
        console.log('[MoodLog] Failed to resolve join date', e);
      }
    })();
  }, [userId]);

  // Load existing logs.
  const loadLogs = useCallback(async () => {
    try {
      const logs = await getMoodLogs();
      const map = new Map<string, EMood>();
      logs.forEach((log) => map.set(log.logDate, log.mood));
      setMoodByDate(map);
    } catch (e) {
      console.log('[MoodLog] Failed to load mood logs', e);
      Toast.show({
        type: 'error',
        text1: 'Could not load your mood logs',
        position: 'bottom',
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  // Keep the picked mood in sync with the selected date.
  useEffect(() => {
    setSelectedMood(moodByDate.get(toISODateKey(selectedDate)) ?? null);
  }, [selectedDate, moodByDate]);

  const dates = useMemo(
    () => buildDateRange(joinDate, today),
    [joinDate, today],
  );

  const selectedKey = toISODateKey(selectedDate);
  const hasExistingLog = moodByDate.has(selectedKey);
  const heroOption = getMoodOption(selectedMood);

  const handleSave = async () => {
    if (selectedMood == null || busy) return;
    setSaving(true);
    try {
      await upsertMoodLog(selectedMood, selectedKey);
      setMoodByDate((prev) => new Map(prev).set(selectedKey, selectedMood));
      Toast.show({
        type: 'success',
        text1: hasExistingLog ? 'Mood updated' : 'Mood saved',
        position: 'bottom',
      });
    } catch (e) {
      console.log('[MoodLog] Save failed', e);
      Toast.show({
        type: 'error',
        text1: 'Could not save your mood',
        position: 'bottom',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (busy) return;
    setDeleting(true);
    try {
      await deleteMoodLog(selectedKey);
      setMoodByDate((prev) => {
        const next = new Map(prev);
        next.delete(selectedKey);
        return next;
      });
      setSelectedMood(null);
      Toast.show({
        type: 'success',
        text1: 'Mood log removed',
        position: 'bottom',
      });
    } catch (e) {
      console.log('[MoodLog] Delete failed', e);
      Toast.show({
        type: 'error',
        text1: 'Could not remove your mood log',
        position: 'bottom',
      });
    } finally {
      setDeleting(false);
    }
  };

  const handlePickerChange = (event: DateTimePickerEvent, date?: Date) => {
    setShowPicker(false);
    if (event.type === 'set' && date) {
      setSelectedDate(startOfDay(date));
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.screen} edges={['bottom']}>
        <View style={styles.centerFill}>
          <ActivityIndicator size="large" color={colors.purple} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={['bottom']}>
      <MoodDateStrip
        dates={dates}
        selectedDate={selectedDate}
        moodByDate={moodByDate}
        onSelect={setSelectedDate}
        onOpenPicker={() => setShowPicker(true)}
      />

      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.bodyContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.selectedDateLabel, globalStyles.fontBold]}>
          {selectedDate.toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
          })}
        </Text>
        <Text style={[styles.prompt, globalStyles.fontRegular]}>
          How are you feeling?
        </Text>

        <View style={styles.hero}>
          <View
            style={[
              styles.heroCircle,
              {
                backgroundColor: heroOption
                  ? `${heroOption.color}22`
                  : colors.lightGray,
              },
            ]}
          >
            <Text style={styles.heroEmoji}>{heroOption?.emoji ?? '🫥'}</Text>
          </View>
          <Text style={[styles.heroLabel, globalStyles.fontBold]}>
            {heroOption?.label ?? 'Tap a face below'}
          </Text>
          {heroOption ? (
            <Text style={[styles.heroCaption, globalStyles.fontRegular]}>
              {heroOption.caption}
            </Text>
          ) : null}
        </View>

        <MoodFaceSelector value={selectedMood} onChange={setSelectedMood} />

        <TouchableOpacity
          activeOpacity={0.8}
          onPress={handleSave}
          disabled={selectedMood == null || busy}
          style={[
            styles.saveButton,
            (selectedMood == null || busy) && styles.saveButtonDisabled,
          ]}
        >
          {saving ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={[styles.saveButtonText, globalStyles.fontBold]}>
              {hasExistingLog ? 'Update mood' : 'Save mood'}
            </Text>
          )}
        </TouchableOpacity>

        {hasExistingLog ? (
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={handleDelete}
            disabled={busy}
            style={[styles.deleteButton, busy && styles.deleteButtonDisabled]}
          >
            {deleting ? (
              <ActivityIndicator color={colors.redBadgeText} size="small" />
            ) : (
              <>
                <Lucide name="trash-2" size={17} color={colors.redBadgeText} />
                <Text style={[styles.deleteButtonText, globalStyles.fontSemiBold]}>
                  Remove this log
                </Text>
              </>
            )}
          </TouchableOpacity>
        ) : null}
      </ScrollView>

      {showPicker && (
        <RNDateTimePicker
          value={selectedDate}
          mode="date"
          display="default"
          minimumDate={joinDate}
          maximumDate={today}
          onChange={handlePickerChange}
        />
      )}
    </SafeAreaView>
  );
};

export default MoodLog;
