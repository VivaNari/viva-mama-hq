import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { MOOD_OPTIONS } from '../../data/moodData';
import { globalStyles } from '../../public/styles';
import { moodLogStyles as styles } from '../../public/styles/moodLogStyles';
import { EMood, MoodOption } from '../../types/moodLog.types';

interface MoodBubbleProps {
  option: MoodOption;
  selected: boolean;
  onPress: (value: EMood) => void;
}

const MoodBubble: React.FC<MoodBubbleProps> = ({ option, selected, onPress }) => {
  return (
    <View style={styles.bubble}>
      <TouchableOpacity activeOpacity={0.8} onPress={() => onPress(option.value)}>
        <View
          style={{
            // Static scattered placement — same offset, rotation and pop as before, no motion.
            transform: [
              { translateY: option.offsetY },
              { rotate: `${option.rotate}deg` },
              { scale: selected ? 1.18 : 1 },
            ],
            opacity: selected ? 1 : 0.9,
          }}
        >
          <View
            style={[
              styles.bubbleCircle,
              {
                width: option.size,
                height: option.size,
                borderColor: selected ? option.color : 'transparent',
                backgroundColor: selected ? `${option.color}22` : '#FFFFFF',
              },
            ]}
          >
            <Text style={{ fontSize: option.size * 0.5 }}>{option.emoji}</Text>
          </View>
          <Text
            style={[
              styles.bubbleLabel,
              globalStyles.fontMedium,
              selected && styles.bubbleLabelSelected,
              { transform: [{ rotate: `${-option.rotate}deg` }] },
            ]}
          >
            {option.label}
          </Text>
        </View>
      </TouchableOpacity>
    </View>
  );
};

interface MoodFaceSelectorProps {
  value: EMood | null;
  onChange: (value: EMood) => void;
}

const MoodFaceSelector: React.FC<MoodFaceSelectorProps> = ({
  value,
  onChange,
}) => {
  return (
    <View style={styles.cluster}>
      {MOOD_OPTIONS.map((option) => (
        <MoodBubble
          key={option.value}
          option={option}
          selected={value === option.value}
          onPress={onChange}
        />
      ))}
    </View>
  );
};

export default MoodFaceSelector;
