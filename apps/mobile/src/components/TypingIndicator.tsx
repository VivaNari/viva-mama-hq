import React from 'react';
import { useTranslation } from 'react-i18next';
import { View, Text, StyleSheet } from 'react-native';

import { colors } from '../public/assets/colors';
import { globalStyles } from '../public/styles';

export const TypingIndicator: React.FC = () => {
    const { t } = useTranslation();
    return (
        <View
            style={styles.container}
            accessibilityLabel="Viva AI is thinking"
            accessibilityRole="text"
        >
            <Text style={[styles.text, globalStyles.fontSemiBold]}>
                {t('chat.vivaThinking')}
            </Text>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        alignSelf: 'flex-start',
        backgroundColor: colors.white,
        borderRadius: 16,
        borderTopLeftRadius: 4,
        marginVertical: 4,
        marginHorizontal: 12,
        paddingHorizontal: 16,
        paddingVertical: 12,
        maxWidth: '80%',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
    },
    text: {
        color: colors.darkGray,
        fontSize: 14,
    },
});