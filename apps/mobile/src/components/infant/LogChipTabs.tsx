import React from 'react';
import { ScrollView, Text, TouchableOpacity } from 'react-native';

import { globalStyles } from '../../public/styles';
import { infantLogStyles } from '../../public/styles/infantLogStyles';

export interface LogChipTab {
    key: string;
    /** Already-translated label. */
    label: string;
    /** Rendered greyed and unpressable — a past date that can no longer be edited. */
    disabled?: boolean;
}

interface LogChipTabsProps {
    tabs: LogChipTab[];
    activeKey: string;
    onChange: (key: string) => void;
}

/**
 * The horizontal pill strip at the top of the Growth, Vaccination and Milestone logs —
 * dates, schedule visits and age bands respectively.
 *
 * Horizontally scrollable by design: the vaccination schedule runs to a dozen visits and
 * the milestone bands to five, neither of which fits a phone width.
 */
const LogChipTabs: React.FC<LogChipTabsProps> = ({ tabs, activeKey, onChange }) => (
    <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={infantLogStyles.chipRow}
    >
        {tabs.map((tab) => {
            const isActive = tab.key === activeKey;

            return (
                <TouchableOpacity
                    key={tab.key}
                    activeOpacity={0.8}
                    disabled={tab.disabled}
                    onPress={() => onChange(tab.key)}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: isActive, disabled: !!tab.disabled }}
                    style={[
                        infantLogStyles.chip,
                        isActive && infantLogStyles.chipActive,
                        tab.disabled && infantLogStyles.chipDisabled,
                    ]}
                >
                    <Text
                        style={[
                            infantLogStyles.chipText,
                            isActive && infantLogStyles.chipTextActive,
                            tab.disabled && infantLogStyles.chipTextDisabled,
                            globalStyles.fontSemiBold,
                        ]}
                    >
                        {tab.label}
                    </Text>
                </TouchableOpacity>
            );
        })}
    </ScrollView>
);

export default LogChipTabs;
