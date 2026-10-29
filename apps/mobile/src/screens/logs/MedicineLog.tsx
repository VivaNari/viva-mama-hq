import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Lucide } from '@react-native-vector-icons/lucide';
import { useTranslation } from 'react-i18next';

import { addMedicine, getMedicines, setMedicineTaken } from '../../api/motherLogs.api';
import { PrimaryButton, SecondaryButton } from '../../components/logs/Buttons';
import Chip from '../../components/logs/Chip';
import LogScreen from '../../components/logs/LogScreen';
import { colors } from '../../public/assets/colors';
import { globalStyles } from '../../public/styles';
import { logsStyles } from '../../public/styles/logsStyles';
import {
    i18nKey,
    MedicineFrequency,
    MedicinePreset,
    MedicinesSnapshot,
    MotherMedicine,
} from '../../types/motherLog.types';
import { showLogError } from '../../utils/motherLogHelpers';

const PRESETS: (MedicinePreset | 'other')[] = ['iron_folic_acid', 'calcium', 'vitamin_d', 'insulin', 'other'];
const OTHER_OPTIONS = [
    'magnesium',
    'multivitamin',
    'probiotic',
    'omega3',
    'folicAcidOnly',
    'thyroid',
    'bloodThinner',
] as const;
const FREQUENCIES: MedicineFrequency[] = ['once_a_day', 'sos', 'twice_a_day', 'thrice_a_day'];

const EMPTY: MedicinesSnapshot = { medicines: [], hasIfa: false, ifaWeek: [] };

const MedicineLog: React.FC = () => {
    const { t } = useTranslation();
    const [snapshot, setSnapshot] = useState<MedicinesSnapshot>(EMPTY);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [showAdd, setShowAdd] = useState(false);
    const [preset, setPreset] = useState<MedicinePreset | 'other'>('iron_folic_acid');
    const [otherName, setOtherName] = useState('');
    const [frequency, setFrequency] = useState<MedicineFrequency>('once_a_day');

    useFocusEffect(
        useCallback(() => {
            getMedicines()
                .then(setSnapshot)
                .catch(error => showLogError(t, 'load', error, 'MedicineLog.load'))
                .finally(() => setLoading(false));
        }, [t]),
    );

    const { medicines, hasIfa, ifaWeek } = snapshot;
    const isOther = preset === 'other';
    const canAdd = (!isOther || otherName.trim().length > 0) && !saving;
    const takenCount = medicines.filter(m => m.takenToday).length;

    const nameOf = (m: MotherMedicine) =>
        m.presetKey ? t(`logs.medicine.presets.${i18nKey(m.presetKey)}`) : (m.name ?? '');

    const openAdd = () => {
        setPreset('iron_folic_acid');
        setOtherName('');
        setFrequency('once_a_day');
        setShowAdd(true);
    };

    const save = async () => {
        if (!canAdd) return;
        setSaving(true);
        try {
            const next = await addMedicine(
                isOther ? { name: otherName.trim() } : { presetKey: preset as MedicinePreset },
                frequency,
            );
            setSnapshot(next);
            setShowAdd(false);
        } catch (error) {
            showLogError(t, 'save', error, 'MedicineLog.add');
        } finally {
            setSaving(false);
        }
    };

    // Flip at once, then confirm with the server; roll back if it refuses.
    const toggleTaken = async (medicine: MotherMedicine) => {
        const before = snapshot;
        setSnapshot(prev => ({
            ...prev,
            medicines: prev.medicines.map(m =>
                m._id === medicine._id ? { ...m, takenToday: !m.takenToday } : m,
            ),
        }));
        try {
            setSnapshot(await setMedicineTaken(medicine._id, !medicine.takenToday));
        } catch (error) {
            setSnapshot(before);
            showLogError(t, 'save', error, 'MedicineLog.toggleTaken');
        }
    };

    return (
        <LogScreen
            title={t('logs.medicine.title')}
            subtitle={
                loading ? undefined : t('logs.medicine.takenToday', { count: takenCount, total: medicines.length })
            }
            contentStyle={{ gap: 10 }}
        >
            {loading ? <ActivityIndicator color={colors.darkPurple} style={{ marginTop: 40 }} /> : null}

            {!loading && hasIfa ? (
                <View style={[logsStyles.itemCard, { flexDirection: 'column', alignItems: 'stretch', gap: 9, paddingVertical: 13, paddingHorizontal: 15 }]}>
                    <View style={logsStyles.spaceBetween}>
                        <Text style={[logsStyles.sectionTitle, { fontSize: 12.5 }, globalStyles.fontBold]}>
                            {t('logs.medicine.ifaThisWeek')}
                        </Text>
                        <Text style={[{ fontSize: 11.5, color: colors.darkPurple }, globalStyles.fontBold]}>
                            {t('logs.medicine.daysOfWeek', { count: ifaWeek.filter(Boolean).length, total: ifaWeek.length })}
                        </Text>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 7 }}>
                        {ifaWeek.map((on, i) => (
                            <View
                                key={i}
                                style={{
                                    flex: 1,
                                    height: 9,
                                    borderRadius: 5,
                                    backgroundColor: on ? colors.darkPurple : colors.vivaStripOff,
                                }}
                            />
                        ))}
                    </View>
                    <Text style={[{ fontSize: 11, color: colors.darkPurple }, globalStyles.fontBold]}>
                        {t('logs.medicine.seeSummary')}
                    </Text>
                </View>
            ) : null}

            {medicines.map(m => (
                <View key={m._id} style={[logsStyles.itemCard, m.takenToday && logsStyles.itemCardDone]}>
                    <View style={logsStyles.iconBadge}>
                        <Lucide name="pill" size={16} color={colors.darkPurple} />
                    </View>
                    <View style={logsStyles.itemBody}>
                        <Text style={[logsStyles.itemTitle, globalStyles.fontBold]}>{nameOf(m)}</Text>
                        <Text style={[logsStyles.itemSub, globalStyles.fontRegular]}>
                            {t(`logs.medicine.frequencies.${i18nKey(m.frequency)}`)}
                        </Text>
                    </View>
                    <TouchableOpacity
                        onPress={() => toggleTaken(m)}
                        accessibilityRole="button"
                        style={[logsStyles.smallActionButton, m.takenToday && logsStyles.smallActionButtonDone]}
                    >
                        <Text
                            style={[
                                logsStyles.smallActionText,
                                m.takenToday && logsStyles.smallActionTextDone,
                                globalStyles.fontBold,
                            ]}
                        >
                            {m.takenToday ? t('logs.medicine.taken') : t('logs.medicine.markTaken')}
                        </Text>
                    </TouchableOpacity>
                </View>
            ))}

            {loading ? null : !showAdd ? (
                <TouchableOpacity
                    onPress={openAdd}
                    accessibilityRole="button"
                    style={[logsStyles.dashedButton, { marginTop: 4, borderRadius: 16 }]}
                >
                    <Lucide name="plus" size={16} color={colors.darkPurple} />
                    <Text style={[logsStyles.dashedButtonText, globalStyles.fontBold]}>{t('logs.medicine.add')}</Text>
                </TouchableOpacity>
            ) : (
                <View style={[logsStyles.itemCard, { flexDirection: 'column', alignItems: 'stretch', borderRadius: 18, padding: 16, gap: 14 }]}>
                    <Text style={[logsStyles.sectionTitle, globalStyles.fontBold]}>{t('logs.medicine.whatAdding')}</Text>
                    <View style={logsStyles.chipRow}>
                        {PRESETS.map(key => (
                            <Chip
                                key={key}
                                small
                                label={t(`logs.medicine.presets.${i18nKey(key)}`)}
                                selected={preset === key}
                                onPress={() => {
                                    setPreset(key);
                                    setOtherName('');
                                }}
                            />
                        ))}
                    </View>

                    {isOther ? (
                        <View style={{ gap: 8 }}>
                            <Text style={[logsStyles.fieldLabel, globalStyles.fontSemiBold]}>
                                {t('logs.medicine.medicineName')}
                            </Text>
                            <TextInput
                                value={otherName}
                                onChangeText={setOtherName}
                                maxLength={60}
                                placeholder={t('logs.medicine.typeName')}
                                placeholderTextColor={colors.vivaFaint}
                                style={[logsStyles.textInput, globalStyles.fontRegular]}
                            />
                            <Text style={[logsStyles.quickPickLabel, globalStyles.fontSemiBold]}>
                                {t('logs.common.orQuickPick')}
                            </Text>
                            <View style={logsStyles.chipRow}>
                                {OTHER_OPTIONS.map(key => {
                                    const label = t(`logs.medicine.otherOptions.${key}`);
                                    return (
                                        <Chip
                                            key={key}
                                            small
                                            label={label}
                                            selected={otherName === label}
                                            onPress={() => setOtherName(label)}
                                        />
                                    );
                                })}
                            </View>
                        </View>
                    ) : null}

                    <Text style={[logsStyles.sectionTitle, { marginTop: 2 }, globalStyles.fontBold]}>
                        {t('logs.medicine.howOften')}
                    </Text>
                    <View style={logsStyles.chipRow}>
                        {FREQUENCIES.map(key => (
                            <Chip
                                key={key}
                                label={t(`logs.medicine.frequencies.${i18nKey(key)}`)}
                                selected={frequency === key}
                                onPress={() => setFrequency(key)}
                            />
                        ))}
                    </View>

                    <View style={[logsStyles.buttonPair, { marginTop: 2 }]}>
                        <SecondaryButton label={t('logs.common.cancel')} onPress={() => setShowAdd(false)} style={{ flex: 1 }} />
                        <PrimaryButton
                            rounded
                            label={t('logs.medicine.addToList')}
                            onPress={save}
                            disabled={!canAdd}
                            style={{ flex: 1.4 }}
                        />
                    </View>
                </View>
            )}
        </LogScreen>
    );
};

export default MedicineLog;
