import React from 'react';
import { Text, View } from 'react-native';
import MaterialDesignIcons from '@react-native-vector-icons/material-design-icons';

import { colors } from '../../public/assets/colors';
import { globalStyles } from '../../public/styles';
import { infantLogStyles } from '../../public/styles/infantLogStyles';

interface LogInfoBannerProps {
    /** Already-translated body copy. */
    text: string;
    /** MaterialDesignIcons glyph. Defaults to the design's information mark. */
    icon?: string;
    /** Pulls the banner to the top of a screen instead of between cards. */
    style?: object;
}

/**
 * The lilac note the design puts at the foot of the Diaper and Milestone logs, and at the
 * head of the 6-months+ feeding log.
 *
 * It carries guidance, not state — never put a tappable action in here.
 */
const LogInfoBanner: React.FC<LogInfoBannerProps> = ({
    text,
    icon = 'information-outline',
    style,
}) => (
    <View style={[infantLogStyles.banner, style]}>
        <MaterialDesignIcons
            name={icon as any}
            size={18}
            color={colors.darkPurple}
        />

        <Text style={[infantLogStyles.bannerText, globalStyles.fontRegular]}>{text}</Text>
    </View>
);

export default LogInfoBanner;
