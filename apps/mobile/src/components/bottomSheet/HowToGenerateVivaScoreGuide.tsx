import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
// import { CalendarCheck, Gauge, LineChart, MessageSquare } from 'lucide-react-native';
import { colors } from '../../public/assets/colors';
import { globalStyles } from '../../public/styles';
import Lucide from '@react-native-vector-icons/lucide';

const HowToGenerateVivaScoreGuide = () => {
    const { t } = useTranslation();

    const renderBoldText = (text: string) => {
        const parts = text.split(/(<bold>.*?<\/bold>)/g);
        return parts.map((part, i) => {
            if (part.startsWith('<bold>') && part.endsWith('</bold>')) {
                return (
                    <Text key={i} style={globalStyles.fontBold}>
                        {part.replace(/<\/?bold>/g, '')}
                    </Text>
                );
            }
            return <Text key={i}>{part}</Text>;
        });
    };

    const steps = [
        { icon: <Lucide name={"calendar-check"} color={colors.white} size={24} /> },
        { icon: <Lucide name={"message-square"} color={colors.white} size={24} /> },
        { icon: <Lucide name={"gauge"} color={colors.white} size={24} /> },
        { icon: <Lucide name={"trending-up"} color={colors.white} size={24} /> },
    ];

    return (
        <View style={styles.container}>
            <View style={styles.headerContainer}>
                <Text style={[globalStyles.fontBold, styles.title]}>
                    {t('vivaScore.howGeneratedTitle')}
                </Text>
                <Text style={[globalStyles.fontRegular, styles.subtitle]}>
                    {t('vivaScore.howGeneratedSubtitle')}
                </Text>
            </View>

            <View style={styles.stepsContainer}>
                {steps.map((step, index) => (
                    <View key={index} style={styles.stepRow}>
                        <View style={styles.iconColumn}>
                            <View style={styles.iconCircle}>
                                {step.icon}
                            </View>
                            {index < steps.length - 1 && <View style={styles.timelineLine} />}
                        </View>
                        <View style={styles.contentColumn}>
                            <Text style={[globalStyles.fontBold, styles.stepLabel]}>
                                {t('vivaScore.steps.stepLabel')} {index + 1}
                            </Text>
                            <Text style={[globalStyles.fontBold, styles.stepTitle]}>
                                {t(`vivaScore.steps.step${index + 1}Title` as any)}
                            </Text>
                            <Text style={[globalStyles.fontRegular, styles.stepBody]}>
                                {t(`vivaScore.steps.step${index + 1}Body` as any)}
                            </Text>
                        </View>
                    </View>
                ))}
            </View>

            <View style={styles.infoBox}>
                <Text style={[globalStyles.fontRegular, styles.infoText]}>
                    {renderBoldText(t('vivaScore.howGeneratedBody'))}
                </Text>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        paddingTop: 10,
        paddingBottom: 20,
    },
    headerContainer: {
        alignItems: 'center',
        marginBottom: 30,
    },
    title: {
        fontSize: 22,
        color: colors.darkPurple,
        textAlign: 'center',
    },
    separator: {
        width: 60,
        height: 3,
        borderRadius: 2,
        marginTop: 15,
        marginBottom: 15,
    },
    subtitle: {
        fontSize: 14,
        color: colors.darkGray,
        textAlign: 'center',
    },
    stepsContainer: {
        marginBottom: 10,
    },
    stepRow: {
        flexDirection: 'row',
    },
    iconColumn: {
        alignItems: 'center',
        marginRight: 15,
        width: 50,
    },
    iconCircle: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: colors.darkPurple,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 2,
    },
    timelineLine: {
        width: 2,
        flex: 1,
        backgroundColor: '#E0E0E0',
        marginVertical: 4,
    },
    contentColumn: {
        flex: 1,
        paddingBottom: 25,
    },
    stepLabel: {
        fontSize: 11,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: 2,
    },
    stepTitle: {
        fontSize: 16,
        color: colors.darkPurple,
        marginBottom: 4,
    },
    stepBody: {
        fontSize: 14,
        color: colors.darkGray,
        lineHeight: 20,
    },
    infoBox: {
        backgroundColor: colors.SubscriptionOptionsBG,
        padding: 20,
        borderRadius: 12,
        marginTop: 10,
    },
    infoText: {
        fontSize: 15,
        color: colors.darkPurple,
        lineHeight: 22,
    },
});

export default HowToGenerateVivaScoreGuide;