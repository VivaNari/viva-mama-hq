import React from 'react';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';
import { Lucide } from '@react-native-vector-icons/lucide';
import { useTranslation } from 'react-i18next';

import { LinkButton } from '../../components/logs/Buttons';
import { ProgressBar, SuccessPill } from '../../components/logs/Feedback';
import LogScreen from '../../components/logs/LogScreen';
import { useDailyCounter } from '../../hooks/useDailyCounter';
import { colors } from '../../public/assets/colors';
import { globalStyles } from '../../public/styles';
import { logsStyles } from '../../public/styles/logsStyles';

const GLASS_GOAL = 8;
// The backend's ceiling for a day's glasses.
const GLASS_MAX = 30;

const WaterLog: React.FC = () => {
    const { t } = useTranslation();
    const { value: glasses, loading, increment, decrement } = useDailyCounter('water', GLASS_MAX);
    const done = glasses >= GLASS_GOAL;

    return (
        <LogScreen title={t('logs.water.title')} contentStyle={{ paddingTop: 24 }}>
            {loading ? <ActivityIndicator color={colors.darkPurple} style={{ marginTop: 40 }} /> : null}

            <View
                style={[logsStyles.dialArea, { gap: 20, paddingVertical: 0 }, loading && { opacity: 0 }]}
                pointerEvents={loading ? 'none' : 'auto'}
            >
                <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={increment}
                    accessibilityRole="button"
                    accessibilityLabel={t('logs.water.addGlass')}
                    style={[
                        logsStyles.dial,
                        { width: 170, height: 170, borderRadius: 85, backgroundColor: colors.darkPurple },
                    ]}
                >
                    <Lucide name="glass-water" size={26} color={colors.white} />
                    <Text style={[logsStyles.dialValue, { fontSize: 38 }, globalStyles.fontBold]}>{glasses}</Text>
                    <Text style={[logsStyles.dialCaption, { fontSize: 12 }, globalStyles.fontRegular]}>
                        {t('logs.water.glassesTap')}
                    </Text>
                </TouchableOpacity>

                <ProgressBar
                    percent={(glasses / GLASS_GOAL) * 100}
                    color={done ? colors.vivaSuccess : colors.darkPurple}
                />
                <Text style={[logsStyles.mutedLabel, { fontSize: 12.5 }, globalStyles.fontRegular]}>
                    {t('logs.water.goal', { goal: GLASS_GOAL })}
                </Text>

                <LinkButton label={t('logs.common.removeLastTap')} onPress={decrement} />

                {done ? <SuccessPill text={t('logs.water.complete')} /> : null}
            </View>
        </LogScreen>
    );
};

export default WaterLog;
