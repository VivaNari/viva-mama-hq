import React from 'react';
import { Text, View } from 'react-native';
import { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';

import { JOURNEY_STAGES, JourneyStage } from '../../data/journey/journeyTypes';
import { globalStyles } from '../../public/styles';
import { journeyStyles as styles } from '../../public/styles/journeyStyles';
import { JourneyPosition } from '../../utils/journeyPosition';

type Placed = Extract<JourneyPosition, { kind: 'pregnant' | 'postpartum' }>;

const DAYS_PER_MONTH = 30.4375;

/** Weeks through pregnancy and the first six weeks; care milestones after that. */
const whereLabel = (position: Placed, t: TFunction): string => {
    if (position.kind === 'pregnant') {
        if (position.inLabour) return t('journey.where.labour');
        if (position.awaitingBirth) return t('journey.where.pastDue');
        return t('journey.where.week', { week: position.week });
    }
    if (position.day === 0) return t('journey.where.birthDay');
    if (position.stage === 'delivery') return t('journey.where.goingHome');
    if (position.day <= 42) return t('journey.where.weekAfterBirth', { week: Math.ceil(position.day / 7) });
    return t('journey.where.monthsAfterBirth', { months: Math.floor(position.day / DAYS_PER_MONTH) });
};

const StageBar: React.FC<{ position: Placed }> = ({ position }) => {
    const { t } = useTranslation();
    const current = JOURNEY_STAGES.indexOf(position.stage);

    const fill = (index: number): number => {
        if (index < current) return 1;
        return index === current ? position.progress : 0;
    };

    return (
        <View style={styles.bar}>
            <Text style={[styles.barCaption, globalStyles.fontBold]}>{t('journey.barCaption')}</Text>
            <View style={styles.barRow}>
                <Text style={[styles.barStage, globalStyles.fontBold]}>{t(`journey.stages.${position.stage}`)}</Text>
                <Text style={[styles.barWhere, globalStyles.fontRegular]}>{whereLabel(position, t)}</Text>
            </View>
            <View style={styles.barSegments}>
                {JOURNEY_STAGES.map((stage, index) => (
                    <View key={stage} style={styles.barSegment}>
                        <View style={[styles.barFill, { width: `${Math.round(fill(index) * 100)}%` }]} />
                    </View>
                ))}
            </View>
            <View style={styles.barNames}>
                {JOURNEY_STAGES.map((stage: JourneyStage, index) => (
                    <Text
                        key={stage}
                        style={[
                            styles.barName,
                            index === current ? [styles.barNameOn, globalStyles.fontSemiBold] : globalStyles.fontRegular,
                        ]}
                    >
                        {t(`journey.stages.${stage}`)}
                    </Text>
                ))}
            </View>
        </View>
    );
};

export default StageBar;
