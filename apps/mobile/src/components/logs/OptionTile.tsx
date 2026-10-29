import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { Lucide } from '@react-native-vector-icons/lucide';

import { colors } from '../../public/assets/colors';
import { globalStyles } from '../../public/styles';
import { logsStyles } from '../../public/styles/logsStyles';
import { LogTileTone } from '../../data/logPickerData';

interface OptionTileProps {
    label: string;
    sub?: string;
    icon: string;
    onPress: () => void;
    tone?: LogTileTone;
    /** Spans the row with the icon beside the label instead of above it. */
    wide?: boolean;
    /** The public picker's bigger tiles: 40pt icon and 14pt label. */
    large?: boolean;
}

const ICON_COLOR: Record<LogTileTone, string> = {
    default: colors.darkPurple,
    reading: colors.vivaAmberText,
    mood: colors.vivaLabel,
};

/** A card in the Viva AI hub and Log Picker grids. */
const OptionTile: React.FC<OptionTileProps> = ({
    label,
    sub,
    icon,
    onPress,
    tone = 'default',
    wide = false,
    large = false,
}) => (
    <TouchableOpacity
        activeOpacity={0.85}
        onPress={onPress}
        accessibilityRole="button"
        style={[
            logsStyles.tile,
            large && { borderRadius: 18, paddingVertical: 18, gap: 12 },
            wide && logsStyles.tileWide,
            tone === 'reading' && logsStyles.tileReading,
            tone === 'mood' && logsStyles.tileMood,
        ]}
    >
        <View
            style={[
                logsStyles.tileIcon,
                large && !wide && logsStyles.tileIconLarge,
                tone !== 'default' && logsStyles.tileIconOnTone,
            ]}
        >
            <Lucide name={icon as any} size={large && !wide ? 22 : 16} color={ICON_COLOR[tone]} />
        </View>

        <View style={{ flexShrink: 1 }}>
            <Text
                style={[
                    logsStyles.tileLabel,
                    large && logsStyles.tileLabelLarge,
                    large ? globalStyles.fontBold : globalStyles.fontSemiBold,
                ]}
            >
                {label}
            </Text>
            {sub ? <Text style={[logsStyles.tileSub, globalStyles.fontRegular]}>{sub}</Text> : null}
        </View>
    </TouchableOpacity>
);

export default OptionTile;
