import { Lucide } from '@react-native-vector-icons/lucide';
import React, { useCallback, useMemo } from 'react';
import { FlatList, Text, TouchableOpacity, View } from 'react-native';
import { getMoodOption } from '../../data/moodData';
import { colors } from '../../public/assets/colors';
import { globalStyles } from '../../public/styles';
import { moodLogStyles as styles } from '../../public/styles/moodLogStyles';
import { EMood } from '../../types/moodLog.types';
import { isSameDay, toISODateKey } from '../../utils/dateKey';

// Chip width (54) + list gap (10) — used by getItemLayout so the FlatList can
// jump to today without measuring every off-screen chip first.
const CHIP_STRIDE = 64;
// stripList's paddingHorizontal. The first chip starts here, not at 0, so offsets
// must include it or the list scrolls to a position that drifts from the real one.
const LIST_PADDING_LEFT = 12;

// Matches toLocaleDateString('en-US', { weekday: 'short' }) without paying for an
// Intl call on every chip on every render — expensive under Hermes, and this list
// runs to hundreds of chips.
const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface MoodDateStripProps {
  dates: Date[];
  selectedDate: Date;
  moodByDate: Map<string, EMood>;
  onSelect: (date: Date) => void;
  onOpenPicker: () => void;
}

interface DateChipProps {
  date: Date;
  weekdayLabel: string;
  dayNumber: number;
  isSelected: boolean;
  isToday: boolean;
  emoji?: string;
  onSelect: (date: Date) => void;
}

/**
 * Memoised so that selecting a date re-renders the two chips that actually
 * changed, not every mounted chip in the range. All props are primitives except
 * `date` and `onSelect`, both of which keep a stable identity between renders.
 */
const DateChip = React.memo<DateChipProps>(
  ({ date, weekdayLabel, dayNumber, isSelected, isToday, emoji, onSelect }) => (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={() => onSelect(date)}
      style={[
        styles.dateChip,
        isToday && styles.dateChipToday,
        isSelected && styles.dateChipSelected,
      ]}
    >
      <Text style={[styles.weekdayText, globalStyles.fontRegular]}>
        {weekdayLabel}
      </Text>
      <Text
        style={[
          styles.dayNumberText,
          globalStyles.fontBold,
          isSelected && styles.dayNumberTextSelected,
        ]}
      >
        {dayNumber}
      </Text>
      {emoji ? (
        <Text style={styles.chipEmoji}>{emoji}</Text>
      ) : (
        <View style={styles.chipEmojiPlaceholder} />
      )}
    </TouchableOpacity>
  ),
);

DateChip.displayName = 'DateChip';

const MoodDateStrip: React.FC<MoodDateStripProps> = ({
  dates,
  selectedDate,
  moodByDate,
  onSelect,
  onOpenPicker,
}) => {
  // Only changes when the range does; a plain `new Date()` here would be a fresh
  // object on every render and defeat the chips' memoisation.
  const todayKey = useMemo(() => toISODateKey(new Date()), []);

  // Newest first, rendered into an `inverted` list — so today sits at the right
  // edge and history runs off to the left, exactly as before, but as index 0.
  //
  // The obvious alternative, `initialScrollIndex={dates.length - 1}`, cannot work
  // here: VirtualizedList._initialRenderRegion only extends *forward* from that
  // index, so anchoring on the last item mounts precisely one cell and leaves
  // every earlier date unrendered until a scroll event widens the window. That is
  // the "chips only appear after I slide" bug. Inverting makes the same view the
  // natural start of the list, so no anchoring is needed at all.
  const reversedDates = useMemo(() => [...dates].reverse(), [dates]);

  const renderChip = useCallback(
    ({ item }: { item: Date }) => {
      const key = toISODateKey(item);
      return (
        <DateChip
          date={item}
          weekdayLabel={WEEKDAY_LABELS[item.getDay()]}
          dayNumber={item.getDate()}
          isSelected={isSameDay(item, selectedDate)}
          isToday={key === todayKey}
          emoji={getMoodOption(moodByDate.get(key))?.emoji}
          onSelect={onSelect}
        />
      );
    },
    [selectedDate, todayKey, moodByDate, onSelect],
  );

  const getItemLayout = useCallback(
    (_: ArrayLike<Date> | null | undefined, index: number) => ({
      length: CHIP_STRIDE,
      offset: LIST_PADDING_LEFT + CHIP_STRIDE * index,
      index,
    }),
    [],
  );

  return (
    <View style={styles.stripWrapper}>
      <TouchableOpacity
        activeOpacity={0.8}
        style={styles.pickerButton}
        onPress={onOpenPicker}
      >
        <Lucide name="calendar" size={22} color={colors.darkPurple} />
      </TouchableOpacity>
      <FlatList
        horizontal
        inverted
        data={reversedDates}
        renderItem={renderChip}
        keyExtractor={toISODateKey}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.stripList}
        getItemLayout={getItemLayout}
        // Already the iOS default, but it defaults to true on Android — where it's
        // a known cause of blank cells in horizontal lists. Chips are cheap to
        // keep mounted.
        removeClippedSubviews={false}
        // Today plus the previous ~11 days are mounted before the first frame, so
        // the strip is populated without waiting for a scroll event.
        initialNumToRender={12}
        maxToRenderPerBatch={12}
        windowSize={11}
      />
    </View>
  );
};

export default MoodDateStrip;
