import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';

import { addMotherLog, getMotherLogs } from '../../api/motherLogs.api';
import { PrimaryButton } from '../../components/logs/Buttons';
import { ProgressBar, SuccessPill, TintNote } from '../../components/logs/Feedback';
import LogScreen from '../../components/logs/LogScreen';
import Stepper from '../../components/logs/Stepper';
import { useCareContext } from '../../hooks/useCareContext';
import { colors } from '../../public/assets/colors';
import { globalStyles } from '../../public/styles';
import { logsStyles } from '../../public/styles/logsStyles';
import { bmiBand, bmiFor } from '../../utils/bmi';
import { showLogError } from '../../utils/motherLogHelpers';

// Where the stepper starts before she has logged a weight (the design's sample value).
const DEFAULT_WEIGHT_KG = 58.4;
const MIN_KG = 30;
const MAX_KG = 200;

const WeightBmiLog: React.FC = () => {
    const { t } = useTranslation();
    const navigation = useNavigation<any>();
    const { heightCm } = useCareContext();
    const [weight, setWeight] = useState(DEFAULT_WEIGHT_KG);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    // Start from her last logged weight, so a small change is a couple of taps.
    useFocusEffect(
        useCallback(() => {
            getMotherLogs({ types: ['weight'], limit: 1 })
                .then(([last]) => {
                    if (last) setWeight(last.fields.weightKg);
                })
                .catch(error => showLogError(t, 'load', error, 'WeightBmiLog.load'))
                .finally(() => setLoading(false));
        }, [t]),
    );

    const bmi = bmiFor(weight, heightCm);
    const band = bmi !== null ? bmiBand(bmi) : null;

    const change = (delta: number) => {
        setWeight(w => Math.min(MAX_KG, Math.max(MIN_KG, Math.round((w + delta) * 10) / 10)));
        setSaved(false);
    };

    const save = async () => {
        setSaving(true);
        try {
            await addMotherLog('weight', { weightKg: weight });
            setSaved(true);
        } catch (error) {
            showLogError(t, 'save', error, 'WeightBmiLog.save');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <LogScreen title={t('logs.weight.title')}>
                <ActivityIndicator color={colors.darkPurple} style={{ marginTop: 40 }} />
            </LogScreen>
        );
    }

    return (
        <LogScreen title={t('logs.weight.title')} contentStyle={{ paddingTop: 20, alignItems: 'center', gap: 18 }}>
            {heightCm ? (
                <Text style={[logsStyles.bodyMuted, globalStyles.fontRegular]}>
                    {t('logs.weight.heightRecordedOnce', { height: heightCm })}
                </Text>
            ) : null}

            <Stepper
                size="lg"
                value={weight.toFixed(1)}
                unit={t('logs.units.kg')}
                onIncrease={() => change(0.1)}
                onDecrease={() => change(-0.1)}
            />

            <View style={[logsStyles.card, { alignSelf: 'stretch', borderRadius: 16, padding: 16, gap: 10 }]}>
                <View style={logsStyles.spaceBetween}>
                    <Text style={[logsStyles.bodyMuted, globalStyles.fontSemiBold]}>{t('logs.weight.bmi')}</Text>
                    <Text style={[logsStyles.itemTitle, { fontSize: 16 }, globalStyles.fontBold]}>{bmi ?? '—'}</Text>
                </View>
                {band ? (
                    <>
                        <ProgressBar percent={band.percent} color={band.color} width="100%" height={8} />
                        <Text style={[{ fontSize: 12, color: band.color }, globalStyles.fontSemiBold]}>
                            {t(`logs.weight.${band.labelKey}`)}
                        </Text>
                    </>
                ) : (
                    <TouchableOpacity onPress={() => navigation.navigate('EditProfile')} accessibilityRole="link">
                        <Text style={[{ fontSize: 12, color: colors.darkPurple, lineHeight: 18 }, globalStyles.fontSemiBold]}>
                            {t('logs.weight.addHeight')}
                        </Text>
                    </TouchableOpacity>
                )}
            </View>

            <TintNote text={t('logs.weight.note')} style={{ alignSelf: 'stretch' }} />

            <PrimaryButton
                label={t('logs.common.saveLog')}
                onPress={save}
                disabled={saving}
                style={{ alignSelf: 'stretch' }}
            />

            {saved ? <SuccessPill text={t('logs.common.saved')} /> : null}
        </LogScreen>
    );
};

export default WeightBmiLog;
