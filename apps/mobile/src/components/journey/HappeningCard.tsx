import React, { useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { CareRoute } from '@vivamama/care-schedules';

import { colors } from '../../public/assets/colors';
import { globalStyles } from '../../public/styles';
import { journeyStyles as styles } from '../../public/styles/journeyStyles';
import { JourneyPosition } from '../../utils/journeyPosition';
import { useCardWidth } from './CardRail';
import JourneyMedia from './JourneyMedia';

type Placed = Extract<JourneyPosition, { kind: 'pregnant' | 'postpartum' }>;

const FIRST_TRIMESTER_LAST_WEEK = 12;
const SECOND_TRIMESTER_LAST_WEEK = 27;

const badgeKey = (position: Placed): string => {
    if (position.kind === 'pregnant' && position.stage === 'pregnancy') {
        if (position.week <= FIRST_TRIMESTER_LAST_WEEK) return 'journey.trimester.first';
        if (position.week <= SECOND_TRIMESTER_LAST_WEEK) return 'journey.trimester.second';
        return 'journey.trimester.third';
    }
    return `journey.stages.${position.stage}`;
};

/** Card 1: what is happening to her now, with the short "learn more" kept on the card. */
const HappeningCard: React.FC<{ position: Placed; route: CareRoute }> = ({ position, route }) => {
    const { t } = useTranslation();
    const { t: content } = useTranslation('journeyContent');
    const width = useCardWidth();
    const [learning, setLearning] = useState(false);

    const base = `mother.${position.row.id}`;
    const chips = content(`${base}.happening.chips`, { returnObjects: true });

    return (
        <View style={[styles.card, { width, backgroundColor: colors.journeyHappeningBG }]}>
            <JourneyMedia
                rowId={position.row.id}
                height={150}
                backgroundColor={colors.darkPurple}
                badge={t(badgeKey(position))}
                badgeColor={colors.journeyBadgeBG}
                badgeTextColor={colors.journeyBadgeText}
            />
            <View style={styles.cardPad}>
                <Text style={[styles.cardLabel, { color: colors.darkPurple }, globalStyles.fontSemiBold]}>
                    {t('journey.happening')}
                </Text>
                <Text style={[styles.cardHeading, globalStyles.fontBold]}>{content(`${base}.happening.headline`)}</Text>
                <Text style={[styles.cardBody, globalStyles.fontRegular]}>{content(`${base}.happening.line`)}</Text>

                {learning ? (
                    <View style={styles.learnBox}>
                        <Text style={[styles.learnTitle, globalStyles.fontBold]}>{content(`${base}.learnMore.title`)}</Text>
                        <Text style={[styles.learnText, globalStyles.fontRegular]}>
                            {content(`${base}.learnMore.${route === 'private' ? 'private' : 'govt'}`)}
                        </Text>
                    </View>
                ) : (
                    <View style={styles.chips}>
                        {(Array.isArray(chips) ? (chips as unknown as string[]) : []).map(chip => (
                            <View key={chip} style={styles.chip}>
                                <Text style={[styles.chipText, globalStyles.fontSemiBold]}>{chip}</Text>
                            </View>
                        ))}
                    </View>
                )}

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
            </View>
        </View>
    );
};

export default HappeningCard;
