import React from 'react';
import { ScrollView, StyleProp, Text, TouchableOpacity, View, ViewStyle } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Lucide } from '@react-native-vector-icons/lucide';
import { useTranslation } from 'react-i18next';

import { colors } from '../../public/assets/colors';
import { globalStyles } from '../../public/styles';
import { logsStyles } from '../../public/styles/logsStyles';

interface LogScreenProps {
    /** Already-translated title. */
    title: string;
    subtitle?: string;
    /** Content above the scroll area that stays put (a banner or a tab strip). */
    fixedTop?: React.ReactNode;
    contentStyle?: StyleProp<ViewStyle>;
    children: React.ReactNode;
}

/**
 * The frame every log screen in the 1000-day design shares: a round back button and
 * title over a lilac page, then a scrolling body. These screens are registered without
 * a navigator header, so this owns the top safe-area inset.
 */
const LogScreen: React.FC<LogScreenProps> = ({
    title,
    subtitle,
    fixedTop,
    contentStyle,
    children,
}) => {
    const navigation = useNavigation();
    const { t } = useTranslation();

    return (
        <SafeAreaView style={logsStyles.screen} edges={['top', 'bottom', 'left', 'right']}>
            <View style={logsStyles.header}>
                <TouchableOpacity
                    style={logsStyles.backButton}
                    onPress={() => navigation.goBack()}
                    accessibilityRole="button"
                    accessibilityLabel={t('logs.common.back')}
                >
                    <Lucide name="chevron-left" size={18} color={colors.vivaInk} />
                </TouchableOpacity>

                <View style={{ flexShrink: 1 }}>
                    <Text style={[logsStyles.headerTitle, globalStyles.fontBold]}>{title}</Text>
                    {subtitle ? (
                        <Text style={[logsStyles.headerSubtitle, globalStyles.fontRegular]}>
                            {subtitle}
                        </Text>
                    ) : null}
                </View>
            </View>

            {fixedTop}

            <ScrollView
                contentContainerStyle={[logsStyles.content, contentStyle]}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
            >
                {children}
            </ScrollView>
        </SafeAreaView>
    );
};

export default LogScreen;
