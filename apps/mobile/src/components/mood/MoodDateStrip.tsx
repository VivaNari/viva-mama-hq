import { Lucide } from '@react-native-vector-icons/lucide';
import React, { useRef } from 'react';
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

interface MoodDateStripProps {
  dates: Date[];
  selectedDate: Date;
  moodByDate: Map<string, EMood>;
  onSelect: (date: Date) => void;
  onOpenPicker: () => void;
}

const MoodDateStrip: React.FC<MoodDateStripProps> = ({
  dates,
  selectedDate,
  moodByDate,
  onSelect,
  onOpenPicker,
}) => {
  const listRef = useRef<FlatList<Date>>(null);
  const today = new Date();

  const renderChip = ({ item }: { item: Date }) => {
    const isSelected = isSameDay(item, selectedDate);
    const isToday = isSameDay(item, today);
    const mood = moodByDate.get(toISODateKey(item));
    const moodOption = getMoodOption(mood);

    return (
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => onSelect(item)}
        style={[
          styles.dateChip,
          isToday && styles.dateChipToday,
          isSelected && styles.dateChipSelected,
        ]}
      >
        <Text style={[styles.weekdayText, globalStyles.fontRegular]}>
          {item.toLocaleDateString('en-US', { weekday: 'short' })}
        </Text>
        <Text
          style={[
            styles.dayNumberText,
            globalStyles.fontBold,
            isSelected && styles.dayNumberTextSelected,
          ]}
        >
          {item.getDate()}
        </Text>
        {moodOption ? (
          <Text style={styles.chipEmoji}>{moodOption.emoji}</Text>
        ) : (
          <View style={styles.chipEmojiPlaceholder} />
        )}
      </TouchableOpacity>
    );
  };

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
        ref={listRef}
        horizontal
        data={dates}
        renderItem={renderChip}
        keyExtractor={(item) => toISODateKey(item)}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.stripList}
        // Today sits at the end of the range — start there so it's visible first.
        getItemLayout={(_, index) => ({
          length: CHIP_STRIDE,
          offset: CHIP_STRIDE * index,
          index,
        })}
        initialScrollIndex={Math.max(0, dates.length - 1)}
        onScrollToIndexFailed={() =>
          listRef.current?.scrollToEnd({ animated: false })
        }
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
      />
    </View>
  );
};

export default MoodDateStrip;
