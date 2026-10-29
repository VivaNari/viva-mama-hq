import React, { useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { PrimaryButton } from '../../components/logs/Buttons';
import { ListRow } from '../../components/logs/Feedback';
import LogScreen from '../../components/logs/LogScreen';
import SegmentedToggle from '../../components/logs/SegmentedToggle';
import Stepper from '../../components/logs/Stepper';
import { useMotherLogs } from '../../hooks/useMotherLogs';
import { colors } from '../../public/assets/colors';
import { globalStyles } from '../../public/styles';
import { logsStyles } from '../../public/styles/logsStyles';
import { PumpingSide } from '../../types/motherLog.types';

// The backend's accepted ranges.
const MAX_MINUTES = 120;
const MAX_ML = 500;

const PumpingLog: React.FC = () => {
    const { t } = useTranslation();
    const [side, setSide] = useState<PumpingSide>('both');
    const [minutes, setMinutes] = useState(15);
    const [quantity, setQuantity] = useState(60);
    const { logs: sessions, loading, saving, add, confirmRemove } = useMotherLogs({
        types: ['pumping'],
        todayOnly: true,
    });

    const totalMinutes = sessions.reduce((sum, s) => sum + (s.fields.minutes ?? 0), 0);
    const totalQuantity = sessions.reduce((sum, s) => sum + (s.fields.ml ?? 0), 0);

    const save = () => add('pumping', { side, minutes, ml: quantity });

    return (
        <LogScreen title={t('logs.pumping.title')} contentStyle={{ paddingTop: 18 }}>
            <Text style={[logsStyles.sectionTitle, globalStyles.fontBold]}>{t('logs.pumping.whichSide')}</Text>
            <SegmentedToggle
                value={side}
                onChange={setSide}
                options={[
                    { key: 'left', label: t('logs.pumping.left') },
                    { key: 'right', label: t('logs.pumping.right') },
                    { key: 'both', label: t('logs.pumping.both') },
                ]}
            />

            <View style={{ flexDirection: 'row', gap: 14 }}>
                <View style={{ flex: 1 }}>
                    <Stepper
                        size="sm"
                        label={t('logs.pumping.duration')}
                        value={minutes}
                        unit={t('logs.units.min')}
                        onIncrease={() => setMinutes(m => Math.min(MAX_MINUTES, m + 1))}
                        onDecrease={() => setMinutes(m => Math.max(1, m - 1))}
                    />
                </View>
                <View style={{ flex: 1 }}>
                    <Stepper
                        size="sm"
                        label={t('logs.pumping.quantity')}
                        value={quantity}
                        unit={t('logs.units.ml')}
                        onIncrease={() => setQuantity(q => Math.min(MAX_ML, q + 10))}
                        onDecrease={() => setQuantity(q => Math.max(0, q - 10))}
                    />
                </View>
            </View>

            <PrimaryButton label={t('logs.common.saveLog')} onPress={save} disabled={saving} style={{ marginTop: 4 }} />

            {loading ? (
                <ActivityIndicator color={colors.darkPurple} style={{ marginTop: 12 }} />
            ) : (
                <>
                    <View style={[logsStyles.card, { gap: 6 }]}>
                        <View style={logsStyles.spaceBetween}>
                            <Text style={[logsStyles.mutedLabel, { fontSize: 12.5 }, globalStyles.fontRegular]}>
                                {t('logs.pumping.todayTotal')}
                            </Text>
                            <Text style={[logsStyles.itemTitle, { fontSize: 14 }, globalStyles.fontBold]}>
                                {t('logs.pumping.timesMinutes', { count: sessions.length, minutes: totalMinutes })}
                            </Text>
                        </View>
                        <View style={logsStyles.spaceBetween}>
                            <Text style={[logsStyles.mutedLabel, { fontSize: 12.5 }, globalStyles.fontRegular]}>
                                {t('logs.pumping.totalPumped')}
                            </Text>
                            <Text style={[{ fontSize: 14, color: colors.darkPurple }, globalStyles.fontBold]}>
                                {t('logs.pumping.ml', { value: totalQuantity })}
                            </Text>
                        </View>
                    </View>

                    <Text style={[logsStyles.mutedLabel, { marginTop: 4 }, globalStyles.fontBold]}>
                        {t('logs.pumping.todaySessions')}
                    </Text>
                    <View style={{ gap: 8 }}>
                        {sessions.length === 0 ? (
                            <Text style={[logsStyles.mutedLabel, globalStyles.fontRegular]}>{t('logs.common.nothingYet')}</Text>
                        ) : null}
                        {sessions.map(session => (
                            <ListRow
                                key={session._id}
                                label={t(`logs.pumping.${session.fields.side}`)}
                                value={t('logs.pumping.sessionValue', {
                                    minutes: session.fields.minutes,
                                    quantity: session.fields.ml,
                                })}
                                onLongPress={() => confirmRemove(session)}
                            />
                        ))}
                    </View>
                </>
            )}
        </LogScreen>
    );
};

export default PumpingLog;
