import React from 'react';
import { DimensionValue, StyleProp, Text, TouchableOpacity, View, ViewStyle } from 'react-native';
import { Lucide } from '@react-native-vector-icons/lucide';
import { useTranslation } from 'react-i18next';

import { colors } from '../../public/assets/colors';
import { globalStyles } from '../../public/styles';
import { logsStyles } from '../../public/styles/logsStyles';
import { PrimaryButton } from './Buttons';

/** The lilac guidance box at the top of the kick, readings and weight logs. */
export const TintNote: React.FC<{ text: string; style?: StyleProp<ViewStyle> }> = ({ text, style }) => (
    <View style={[logsStyles.tintNote, style]}>
        <Text style={[logsStyles.tintNoteText, globalStyles.fontRegular]}>{text}</Text>
    </View>
);

/** The amber "higher than usual" warning under a reading. */
export const AmberNote: React.FC<{ text: string }> = ({ text }) => (
    <View style={logsStyles.amberNote}>
        <Text style={[logsStyles.amberNoteText, globalStyles.fontRegular]}>{text}</Text>
    </View>
);

/** The green pill shown once a goal is met or a log is saved. */
export const SuccessPill: React.FC<{ text: string }> = ({ text }) => (
    <View style={logsStyles.successPill}>
        <Text style={[logsStyles.successPillText, globalStyles.fontSemiBold]}>{text}</Text>
    </View>
);

interface ProgressBarProps {
    /** 0 to 100. */
    percent: number;
    color: string;
    width?: DimensionValue;
    height?: number;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({ percent, color, width = 260, height = 10 }) => (
    <View style={[logsStyles.progressTrack, { width, height }]}>
        <View
            style={[
                logsStyles.progressFill,
                { width: `${Math.max(0, Math.min(100, percent))}%`, backgroundColor: color },
            ]}
        />
    </View>
);

interface DoneStateProps {
    title: string;
    subtitle: string;
    actionLabel: string;
    onAction: () => void;
}

/** The green tick, title and "Log more" button that replaces a form once it is saved. */
export const DoneState: React.FC<DoneStateProps> = ({ title, subtitle, actionLabel, onAction }) => (
    <View style={logsStyles.doneWrap}>
        <View style={logsStyles.doneIcon}>
            <Lucide name="check" size={28} color={colors.vivaSuccess} />
        </View>
        <Text style={[logsStyles.doneTitle, globalStyles.fontBold]}>{title}</Text>
        <Text style={[logsStyles.doneSub, globalStyles.fontRegular]}>{subtitle}</Text>
        <PrimaryButton label={actionLabel} onPress={onAction} style={{ alignSelf: 'stretch', marginTop: 4 }} />
    </View>
);

/**
 * One "label · value" row in a recent-readings or sessions list. With `onLongPress`
 * (today's entries only) a long press offers to remove it.
 */
export const ListRow: React.FC<{ label: string; value: string; onLongPress?: () => void }> = ({
    label,
    value,
    onLongPress,
}) => {
    const { t } = useTranslation();

    return (
        <TouchableOpacity
            activeOpacity={onLongPress ? 0.7 : 1}
            disabled={!onLongPress}
            onLongPress={onLongPress}
            accessibilityHint={onLongPress ? t('logs.common.longPressToRemove') : undefined}
            style={logsStyles.listRow}
        >
            <Text style={[logsStyles.listRowLabel, globalStyles.fontSemiBold]}>{label}</Text>
            <Text style={[logsStyles.listRowValue, globalStyles.fontMedium]}>{value}</Text>
        </TouchableOpacity>
    );
};
