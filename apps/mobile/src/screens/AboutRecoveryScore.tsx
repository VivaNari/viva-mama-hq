import React from 'react';
import { useTranslation } from 'react-i18next';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../public/assets/colors';
import { globalStyles } from '../public/styles';

const AboutRecoveryScore = () => {
    const { t } = useTranslation();
    return (
        <SafeAreaView style={styles.safeArea} edges={['bottom', 'left', 'right']}>
            <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
                
                <Text style={[globalStyles.fontBold, styles.heading]}>
                    {t('aboutScore.whatIs')}
                </Text>

                <Text style={[globalStyles.fontRegular, styles.paragraph]}>
                    {t('aboutScore.intro1')}
                </Text>

                <Text style={[globalStyles.fontRegular, styles.paragraph]}>
                    {t('aboutScore.intro2')}
                </Text>

                <Text style={[globalStyles.fontBold, styles.heading, { marginTop: 10 }]}>
                    {t('aboutScore.howCalculated')}
                </Text>

                <Text style={[globalStyles.fontRegular, styles.paragraph]}>
                    {t('aboutScore.howCalculatedBody')}
                </Text>

                <View style={styles.disclaimerContainer}>
                    <Text style={[globalStyles.fontBold, styles.disclaimerTitle]}>{t('aboutScore.disclaimerTitle')}</Text>
                    <Text style={[globalStyles.fontRegular, styles.disclaimerText]}>
                        {t('aboutScore.reflects')}
                    </Text>
                    <Text style={[globalStyles.fontRegular, styles.disclaimerText, { marginTop: 5 }]}>
                        {t('vivaScore.disclaimer2')}
                    </Text>
                    <Text style={[globalStyles.fontRegular, styles.disclaimerText, { marginTop: 5 }]}>
                        {t('vivaScore.disclaimer3')}
                    </Text>
                    <Text style={[globalStyles.fontRegular, styles.disclaimerText, { marginTop: 5 }]}>
                        {t('vivaScore.disclaimer4')}
                    </Text>
                </View>

            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: colors.white,
    },
    container: {
        flex: 1,
        paddingHorizontal: 20,
    },
    contentContainer: {
        paddingVertical: 20,
        paddingBottom: 40,
    },
    heading: {
        fontSize: 20,
        color: colors.darkPurple,
        marginBottom: 10,
    },
    paragraph: {
        fontSize: 16,
        color: colors.black,
        marginBottom: 20,
        lineHeight: 24,
    },
    disclaimerContainer: {
        marginTop: 20,
        padding: 15,
        backgroundColor: colors.lightGray,
        borderRadius: 10,
    },
    disclaimerTitle: {
        fontSize: 14,
        color: colors.darkGray,
        marginBottom: 8,
    },
    disclaimerText: {
        fontSize: 12,
        color: colors.darkGray,
    }
});

export default AboutRecoveryScore;
