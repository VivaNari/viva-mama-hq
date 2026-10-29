import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

import { globalStyles } from '../../public/styles';
import { logsStyles } from '../../public/styles/logsStyles';

export interface SegmentOption<K extends string> {
    key: K;
    /** Already-translated label. */
    label: string;
}

interface SegmentedToggleProps<K extends string> {
    options: SegmentOption<K>[];
    value: K;
    onChange: (key: K) => void;
    /**
     * `pill`: purple pill on a lilac track (sides, reading types).
     * `tab`: white raised tab on a grey track (the ANC screen's two views).
     */
    variant?: 'pill' | 'tab';
    /** Overrides the label size; the readings tabs run smaller to fit four. */
    fontSize?: number;
}

function SegmentedToggle<K extends string>({
    options,
    value,
    onChange,
    variant = 'pill',
    fontSize,
}: SegmentedToggleProps<K>) {
    const isTab = variant === 'tab';

    return (
        <View style={isTab ? logsStyles.tabTrack : logsStyles.toggleTrack} accessibilityRole="tablist">
            {options.map(option => {
                const active = option.key === value;

                return (
                    <TouchableOpacity
                        key={option.key}
                        activeOpacity={0.85}
                        onPress={() => onChange(option.key)}
                        accessibilityRole="tab"
                        accessibilityState={{ selected: active }}
                        style={[
                            isTab ? logsStyles.tabOption : logsStyles.toggleOption,
                            active && (isTab ? logsStyles.tabOptionActive : logsStyles.toggleOptionActive),
                        ]}
                    >
                        <Text
                            style={[
                                isTab ? logsStyles.tabText : logsStyles.toggleText,
                                active && (isTab ? logsStyles.tabTextActive : logsStyles.toggleTextActive),
                                fontSize ? { fontSize } : null,
                                globalStyles.fontBold,
                            ]}
                        >
                            {option.label}
                        </Text>
                    </TouchableOpacity>
                );
            })}
        </View>
    );
}

export default SegmentedToggle;
