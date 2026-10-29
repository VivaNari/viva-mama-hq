import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { PrimaryButton } from '../../components/logs/Buttons';
import Chip from '../../components/logs/Chip';
import { AmberNote, ListRow, TintNote } from '../../components/logs/Feedback';
import LogScreen from '../../components/logs/LogScreen';
import SegmentedToggle from '../../components/logs/SegmentedToggle';
import Stepper from '../../components/logs/Stepper';
import { useCareContext } from '../../hooks/useCareContext';
import { useMotherLogs } from '../../hooks/useMotherLogs';
import { colors } from '../../public/assets/colors';
import { globalStyles } from '../../public/styles';
import { logsStyles } from '../../public/styles/logsStyles';
import { AppendLogType, MotherLog, SugarTiming, i18nKey } from '../../types/motherLog.types';
import { bmiFor } from '../../utils/bmi';
import { formatLogTime } from '../../utils/motherLogHelpers';

type Tab = 'bp' | 'sugar' | 'weight' | 'other';

// Warning cut-offs from the design; to be confirmed with the clinical advisors.
const BP_HIGH = { systolic: 140, diastolic: 90 };
const SUGAR_HIGH: Record<SugarTiming, number> = { fasting: 95, post_meal: 140 };

// "Other" readings: which log type and field each one is stored as, and its range.
const OTHER_PRESETS = [
    { key: 'temperature', logType: 'temperature', field: 'valueF', unitKey: 'fahrenheit', step: 0.2, start: 98.6, min: 90, max: 110 },
    { key: 'hb', logType: 'hb', field: 'value', unitKey: 'gdl', step: 0.1, start: 11.5, min: 2, max: 20 },
    { key: 'urineProtein', logType: 'urine_protein', field: 'value', unitKey: 'plus', step: 1, start: 0, min: 0, max: 4 },
    { key: 'fetalHeartRate', logType: 'fetal_heart_rate', field: 'bpm', unitKey: 'bpm', step: 2, start: 140, min: 60, max: 220 },
] as const;

const READING_TYPES: AppendLogType[] = [
    'bp',
    'sugar',
    'weight',
    ...OTHER_PRESETS.map(preset => preset.logType),
];
const RECENT_COUNT = 10;

const round1 = (n: number) => Math.round(n * 10) / 10;
const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

const ReadingsLog: React.FC = () => {
    const { t, i18n } = useTranslation();
    const { heightCm } = useCareContext();
    const { logs, loading, saving, add, confirmRemove, canRemove } = useMotherLogs({
        types: READING_TYPES,
        limit: 200,
    });
    const [tab, setTab] = useState<Tab>('bp');

    const [systolic, setSystolic] = useState(118);
    const [diastolic, setDiastolic] = useState(78);
    const [sugar, setSugar] = useState(92);
    const [sugarTiming, setSugarTiming] = useState<SugarTiming>('fasting');
    const [weight, setWeight] = useState(58.4);
    const [otherIndex, setOtherIndex] = useState(0);
    const [otherValue, setOtherValue] = useState<number>(OTHER_PRESETS[0].start);

    // Start the weight stepper from her last logged weight, once.
    const seededWeight = useRef(false);
    useEffect(() => {
        if (seededWeight.current || loading) return;
        seededWeight.current = true;
        const last = logs.find(log => log.logType === 'weight');
        if (last) setWeight(last.fields.weightKg);
    }, [loading, logs]);

    const bpHigh = systolic >= BP_HIGH.systolic || diastolic >= BP_HIGH.diastolic;
    const sugarHigh = sugar >= SUGAR_HIGH[sugarTiming];
    const bmi = bmiFor(weight, heightCm);
    const otherPreset = OTHER_PRESETS[otherIndex];
    const unit = (unitKey: string) => t(`logs.units.${unitKey}`);

    const valueOf = (log: MotherLog): string => {
        const f = log.fields;
        switch (log.logType) {
            case 'bp':
                return t('logs.readings.bpValue', { systolic: f.systolic, diastolic: f.diastolic });
            case 'sugar':
                return `${f.value} ${unit('mgdl')}`;
            case 'weight':
                return log.bmi != null
                    ? t('logs.readings.weightValue', { weight: f.weightKg.toFixed(1), bmi: log.bmi })
                    : `${f.weightKg.toFixed(1)} ${unit('kg')}`;
            default: {
                const preset = OTHER_PRESETS.find(p => p.logType === log.logType);
                return preset ? `${f[preset.field]} ${unit(preset.unitKey)}` : '';
            }
        }
    };

    const labelOf = (log: MotherLog): string => {
        const when = formatLogTime(log.loggedAt, t, i18n.language);
        return log.logType === 'sugar'
            ? `${when} · ${t(`logs.readings.${i18nKey(log.fields.timing)}`)}`
            : when;
    };

    const recent = (logType: AppendLogType) => {
        const rows = logs.filter(log => log.logType === logType).slice(0, RECENT_COUNT);
        return (
            <>
                <Text style={[logsStyles.mutedLabel, { marginTop: 4 }, globalStyles.fontBold]}>
                    {t('logs.readings.recent')}
                </Text>
                {loading ? <ActivityIndicator color={colors.darkPurple} /> : null}
                {!loading && rows.length === 0 ? (
                    <Text style={[logsStyles.mutedLabel, globalStyles.fontRegular]}>{t('logs.common.nothingYet')}</Text>
                ) : null}
                {rows.map(log => (
                    <ListRow
                        key={log._id}
                        label={labelOf(log)}
                        value={valueOf(log)}
                        {...(canRemove(log) ? { onLongPress: () => confirmRemove(log) } : {})}
                    />
                ))}
            </>
        );
    };

    const fixedTop = (
        <View style={{ paddingHorizontal: 20, paddingTop: 14, gap: 14 }}>
            <TintNote text={t('logs.readings.intro')} />
            <SegmentedToggle
                value={tab}
                onChange={setTab}
                fontSize={11.5}
                options={[
                    { key: 'bp', label: t('logs.readings.tabs.bp') },
                    { key: 'sugar', label: t('logs.readings.tabs.sugar') },
                    { key: 'weight', label: t('logs.readings.tabs.weight') },
                    { key: 'other', label: t('logs.readings.tabs.other') },
                ]}
            />
        </View>
    );

    return (
        <LogScreen title={t('logs.readings.title')} fixedTop={fixedTop} contentStyle={{ paddingTop: 18 }}>
            {tab === 'bp' ? (
                <>
                    <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 16 }}>
                        <Stepper
                            vertical
                            size="sm"
                            valueSize={28}
                            label={t('logs.readings.systolic')}
                            value={systolic}
                            onIncrease={() => setSystolic(v => clamp(v + 1, 60, 250))}
                            onDecrease={() => setSystolic(v => clamp(v - 1, 60, 250))}
                        />
                        <Text style={[{ fontSize: 26, color: colors.vivaFaint, alignSelf: 'center' }, globalStyles.fontRegular]}>
                            /
                        </Text>
                        <Stepper
                            vertical
                            size="sm"
                            valueSize={28}
                            label={t('logs.readings.diastolic')}
                            value={diastolic}
                            onIncrease={() => setDiastolic(v => clamp(v + 1, 40, 150))}
                            onDecrease={() => setDiastolic(v => clamp(v - 1, 40, 150))}
                        />
                    </View>
                    {bpHigh ? <AmberNote text={t('logs.readings.bpHigh')} /> : null}
                    <PrimaryButton
                        label={t('logs.readings.save')}
                        disabled={saving}
                        onPress={() => add('bp', { systolic, diastolic })}
                    />
                    {recent('bp')}
                </>
            ) : null}

            {tab === 'sugar' ? (
                <>
                    <Stepper
                        value={sugar}
                        unit={unit('mgdl')}
                        onIncrease={() => setSugar(v => clamp(v + 1, 20, 500))}
                        onDecrease={() => setSugar(v => clamp(v - 1, 20, 500))}
                    />
                    <View style={[logsStyles.chipRow, { justifyContent: 'center' }]}>
                        <Chip
                            label={t('logs.readings.fasting')}
                            selected={sugarTiming === 'fasting'}
                            onPress={() => setSugarTiming('fasting')}
                        />
                        <Chip
                            label={t('logs.readings.postMeal')}
                            selected={sugarTiming === 'post_meal'}
                            onPress={() => setSugarTiming('post_meal')}
                        />
                    </View>
                    {sugarHigh ? <AmberNote text={t('logs.readings.sugarHigh')} /> : null}
                    <PrimaryButton
                        label={t('logs.readings.save')}
                        disabled={saving}
                        onPress={() => add('sugar', { value: sugar, timing: sugarTiming })}
                    />
                    {recent('sugar')}
                </>
            ) : null}

            {tab === 'weight' ? (
                <>
                    {heightCm ? (
                        <Text style={[logsStyles.mutedLabel, { textAlign: 'center' }, globalStyles.fontRegular]}>
                            {t('logs.readings.heightOnFile', { height: heightCm })}
                        </Text>
                    ) : null}
                    <Stepper
                        value={weight.toFixed(1)}
                        unit={unit('kg')}
                        onIncrease={() => setWeight(w => clamp(round1(w + 0.1), 30, 200))}
                        onDecrease={() => setWeight(w => clamp(round1(w - 0.1), 30, 200))}
                    />
                    {bmi !== null ? (
                        <Text style={[logsStyles.bodyMuted, globalStyles.fontRegular]}>
                            {t('logs.readings.bmiLabel')}{' '}
                            <Text style={[{ color: colors.vivaInk }, globalStyles.fontBold]}>{bmi}</Text>
                        </Text>
                    ) : (
                        <Text style={[logsStyles.bodyMuted, globalStyles.fontRegular]}>{t('logs.weight.addHeight')}</Text>
                    )}
                    <PrimaryButton
                        label={t('logs.readings.save')}
                        disabled={saving}
                        onPress={() => add('weight', { weightKg: weight })}
                    />
                    {recent('weight')}
                </>
            ) : null}

            {tab === 'other' ? (
                <>
                    <Text style={[logsStyles.fieldLabel, { fontSize: 12.5 }, globalStyles.fontSemiBold]}>
                        {t('logs.readings.whatLogging')}
                    </Text>
                    <View style={logsStyles.chipRow}>
                        {OTHER_PRESETS.map((preset, index) => (
                            <Chip
                                key={preset.key}
                                small
                                variant="solid"
                                label={t(`logs.readings.other.${preset.key}`)}
                                selected={index === otherIndex}
                                onPress={() => {
                                    setOtherIndex(index);
                                    setOtherValue(preset.start);
                                }}
                            />
                        ))}
                    </View>
                    <Stepper
                        value={round1(otherValue)}
                        unit={unit(otherPreset.unitKey)}
                        onIncrease={() =>
                            setOtherValue(v => clamp(round1(v + otherPreset.step), otherPreset.min, otherPreset.max))
                        }
                        onDecrease={() =>
                            setOtherValue(v => clamp(round1(v - otherPreset.step), otherPreset.min, otherPreset.max))
                        }
                    />
                    <PrimaryButton
                        label={t('logs.readings.save')}
                        disabled={saving}
                        onPress={() => add(otherPreset.logType, { [otherPreset.field]: round1(otherValue) })}
                    />
                    {recent(otherPreset.logType)}
                </>
            ) : null}
        </LogScreen>
    );
};

export default ReadingsLog;
