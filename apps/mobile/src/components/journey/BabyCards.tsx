import React, { useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { CareRoute } from '@vivamama/care-schedules';

import { BabyLogAction, JourneyBabyRow } from '../../data/journey/journeyTypes';
import { colors } from '../../public/assets/colors';
import { globalStyles } from '../../public/styles';
import { journeyStyles as styles } from '../../public/styles/journeyStyles';
import { InfantLogRouteParams } from '../../types/infantLog.types';
import JourneyMedia from './JourneyMedia';

const LOG_SCREENS: Record<BabyLogAction, string> = {
    feeding: 'FeedingLog',
    growth: 'GrowthLog',
    vaccination: 'VaccinationLog',
    milestone: 'MilestoneLog',
};

const Mini: React.FC<{ label: string; text: string }> = ({ label, text }) => (
    <View style={styles.mini}>
        <Text style={[styles.miniLabel, globalStyles.fontBold]}>{label}</Text>
        <Text style={[styles.miniText, globalStyles.fontRegular]}>{text}</Text>
    </View>
);

/** Before birth: the baby this week, next week, and something to do together. */
export const BabyWeekCard: React.FC<{ row: JourneyBabyRow; route: CareRoute; week: number }> = ({ row, route, week }) => {
    const { t } = useTranslation();
    const { t: content } = useTranslation('journeyContent');
    const navigation = useNavigation<any>();
    const base = `baby.${row.id}`;
    const side = route === 'private' ? 'private' : 'govt';

    return (
        <View style={styles.babyCard}>
            <JourneyMedia
                video="baby"
                backgroundColor={colors.journeyTeal}
                badge={content(`${base}.size`)}
                badgeColor={colors.white}
                badgeTextColor={colors.journeyTealText}
            />
            <View style={styles.cardPad}>
                <Text style={[styles.cardLabel, { color: colors.journeyTealText }, globalStyles.fontSemiBold]}>
                    {t('journey.baby.weekLabel', { week })}
                </Text>
                <Text style={[styles.cardHeading, globalStyles.fontBold]}>{content(`${base}.card1.text`)}</Text>
                <Mini label={content(`${base}.card2.title`)} text={content(`${base}.card2.${side}`)} />
                <Mini label={content(`${base}.card3.title`)} text={content(`${base}.card3.${side}`)} />
                <Text style={[styles.smallNote, globalStyles.fontRegular]}>{t('journey.baby.babiesVary')}</Text>
                <TouchableOpacity
                    style={[styles.bigButton, { backgroundColor: colors.journeyTeal }]}
                    onPress={() => navigation.navigate('ChatWithVivaAI')}
                    accessibilityRole="button"
                >
                    <Text style={[styles.bigButtonText, globalStyles.fontSemiBold]}>{t('journey.baby.askViva')}</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
};

interface BabyGrowingCardProps {
    row: JourneyBabyRow;
    route: CareRoute;
    /** Null until her baby has been added, when there is no log to open yet. */
    logParams: InfantLogRouteParams | null;
}

/** From birth: how the baby is growing, what is coming up, and today's log. */
export const BabyGrowingCard: React.FC<BabyGrowingCardProps> = ({ row, route, logParams }) => {
    const { t } = useTranslation();
    const { t: content } = useTranslation('journeyContent');
    const navigation = useNavigation<any>();
    const [learning, setLearning] = useState(false);
    const base = `baby.${row.id}`;
    const side = route === 'private' ? 'private' : 'govt';
    const logAction = row.log?.[side];
    const learnTitle = content(`${base}.learnMore.title`, { defaultValue: '' });

    return (
        <View style={styles.babyCard}>
            <JourneyMedia
                video="baby"
                backgroundColor={colors.journeyTeal}
                badgeColor={colors.white}
                badgeTextColor={colors.journeyTealText}
            />
            <View style={styles.cardPad}>
                <Text style={[styles.cardLabel, { color: colors.journeyTealText }, globalStyles.fontSemiBold]}>
                    {content(`${base}.card1.title`)}
                </Text>
                <Text style={[styles.cardHeading, globalStyles.fontBold]}>{content(`${base}.card1.text`)}</Text>
                <Mini label={content(`${base}.card2.title`)} text={content(`${base}.card2.${side}`)} />

                {logAction && logParams ? (
                    <TouchableOpacity
                        onPress={() => navigation.navigate(LOG_SCREENS[logAction], logParams)}
                        accessibilityRole="button"
                        accessibilityHint={t('journey.baby.openLog')}
                    >
                        <Mini label={content(`${base}.card3.title`)} text={content(`${base}.card3.${side}`)} />
                    </TouchableOpacity>
                ) : (
                    <Mini label={content(`${base}.card3.title`)} text={content(`${base}.card3.${side}`)} />
                )}

                {learnTitle ? (
                    <>
                        {learning ? (
                            <View style={styles.learnBox}>
                                <Text style={[styles.learnTitle, globalStyles.fontBold]}>{learnTitle}</Text>
                                <Text style={[styles.learnText, globalStyles.fontRegular]}>
                                    {content(`${base}.learnMore.text`)}
                                </Text>
                            </View>
                        ) : null}
                        <TouchableOpacity
                            style={styles.learnButton}
                            onPress={() => setLearning(on => !on)}
                            accessibilityRole="button"
                            accessibilityState={{ expanded: learning }}
                        >
                            <Text style={[styles.learnButtonText, globalStyles.fontSemiBold]}>
                                {t(learning ? 'journey.showLess' : 'journey.learnMore')}
                            </Text>
                        </TouchableOpacity>
                    </>
                ) : null}
            </View>
        </View>
    );
};
