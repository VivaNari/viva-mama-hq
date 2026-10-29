import React from 'react';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { LinkButton } from '../../components/logs/Buttons';
import { ProgressBar, SuccessPill, TintNote } from '../../components/logs/Feedback';
import LogScreen from '../../components/logs/LogScreen';
import { useDailyCounter } from '../../hooks/useDailyCounter';
import { colors } from '../../public/assets/colors';
import { globalStyles } from '../../public/styles';
import { logsStyles } from '../../public/styles/logsStyles';

const KICK_GOAL = 10;
// The backend's ceiling for a day's count.
const KICK_MAX = 200;

const KickCounter: React.FC = () => {
    const { t } = useTranslation();
    const { value: kicks, loading, increment, decrement } = useDailyCounter('kicks', KICK_MAX);
    const done = kicks >= KICK_GOAL;
    const fill = done ? colors.vivaSuccess : colors.darkPurple;

    return (
        <LogScreen title={t('logs.kicks.title')}>
            <TintNote text={t('logs.kicks.intro')} />

            {loading ? <ActivityIndicator color={colors.darkPurple} style={{ marginTop: 40 }} /> : null}

            <View style={[logsStyles.dialArea, loading && { opacity: 0 }]} pointerEvents={loading ? 'none' : 'auto'}>
                <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={increment}
                    accessibilityRole="button"
                    accessibilityLabel={t('logs.kicks.tap')}
                    style={[logsStyles.dial, { width: 190, height: 190, borderRadius: 95, backgroundColor: fill }]}
                >
                    <Text style={[logsStyles.dialValue, { fontSize: 52 }, globalStyles.fontBold]}>{kicks}</Text>
                    <Text style={[logsStyles.dialCaption, globalStyles.fontSemiBold]}>{t('logs.kicks.tap')}</Text>
                </TouchableOpacity>

                <ProgressBar percent={(kicks / KICK_GOAL) * 100} color={fill} />
                <Text style={[logsStyles.mutedLabel, { fontSize: 12.5 }, globalStyles.fontRegular]}>
                    {t('logs.kicks.goal', { count: kicks, goal: KICK_GOAL })}
                </Text>

                {done ? <SuccessPill text={t('logs.kicks.complete')} /> : null}

                <LinkButton label={t('logs.common.removeLastTap')} onPress={decrement} />
            </View>

            <Text style={[logsStyles.disclaimer, globalStyles.fontRegular]}>{t('logs.kicks.disclaimer')}</Text>
        </LogScreen>
    );
};

export default KickCounter;
