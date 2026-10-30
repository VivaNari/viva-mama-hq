import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Lucide } from '@react-native-vector-icons/lucide';
import { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import Toast from 'react-native-toast-message';

import { confirmChatLog } from '../../api/chatLogs.api';
import { recordError } from '../../analytics';
import { colors } from '../../public/assets/colors';
import { globalStyles } from '../../public/styles/globalStyles';
import { IPendingLog } from '../../types/chat.types';
import { i18nKey } from '../../types/motherLog.types';

interface LogProposalCardProps {
    messageId: string;
    pendingLogs?: IPendingLog[];
}

// The log screen each type opens on "View".
const SCREEN_FOR: Record<string, string> = {
    bp: 'ReadingsLog',
    sugar: 'ReadingsLog',
    weight: 'ReadingsLog',
    hb: 'ReadingsLog',
    temperature: 'ReadingsLog',
    urine_protein: 'ReadingsLog',
    fetal_heart_rate: 'ReadingsLog',
    water: 'WaterLog',
    kicks: 'KickCounter',
    medicine_dose: 'MedicineLog',
    pumping: 'PumpingLog',
    meal: 'MealsLog',
};

/** One line for a proposed log, in her language: "BP 118/80 mmHg", "Water +2 glasses". */
export const describePendingLog = (item: IPendingLog, t: TFunction): string => {
    const f = item.fields ?? {};
    switch (item.logType) {
        case 'bp':
            return `${t('logs.readings.tabs.bp')} ${f.systolic}/${f.diastolic} mmHg`;
        case 'sugar':
            return `${t('logs.readings.tabs.sugar')} ${f.value} ${t('logs.units.mgdl')} · ${t(
                `logs.readings.${i18nKey(f.timing ?? 'fasting')}`,
            )}`;
        case 'weight':
            return `${t('logs.readings.tabs.weight')} ${f.weightKg} ${t('logs.units.kg')}`;
        case 'hb':
            return `${t('logs.readings.other.hb')} ${f.value} ${t('logs.units.gdl')}`;
        case 'temperature':
            return `${t('logs.readings.other.temperature')} ${f.valueF} ${t('logs.units.fahrenheit')}`;
        case 'urine_protein':
            return `${t('logs.readings.other.urineProtein')} ${f.value}+`;
        case 'fetal_heart_rate':
            return `${t('logs.readings.other.fetalHeartRate')} ${f.bpm} ${t('logs.units.bpm')}`;
        case 'water':
            return item.mode === 'set'
                ? t('chatLogs.waterSet', { count: f.glasses })
                : t('chatLogs.waterAdd', { count: f.glasses });
        case 'kicks':
            return item.mode === 'set'
                ? t('chatLogs.kicksSet', { count: f.count })
                : t('chatLogs.kicksAdd', { count: f.count });
        case 'medicine_dose': {
            const ref = item.medicineRef ?? {};
            const name = ref.presetKey
                ? t(`logs.medicine.presets.${i18nKey(ref.presetKey)}`)
                : ref.name ?? '';
            return t('chatLogs.medicineTaken', { name });
        }
        case 'pumping':
            return `${t('logs.picker.pumping')} · ${t(`logs.pumping.${f.side}`)} · ${t(
                'logs.pumping.sessionValue',
                { minutes: f.minutes, quantity: f.ml },
            )}`;
        case 'meal':
            return `${t(`logs.meals.times.${i18nKey(f.mealTime ?? 'lunch')}`)} · ${(f.foods ?? [])
                .map((food: string) => t(`logs.meals.foods.${food}`))
                .join(', ')}`;
        default:
            return item.logType;
    }
};

/**
 * "Save to your logs?" under a Viva reply that read a reading or a daily log from her
 * message. Nothing is saved until she taps Yes; No leaves her logs untouched.
 *
 * The items come from the server (already validated) and are answered one call each;
 * the server makes a second answer harmless, so a retry never saves twice.
 */
export const LogProposalCard: React.FC<LogProposalCardProps> = ({ messageId, pendingLogs }) => {
    const { t } = useTranslation();
    const navigation = useNavigation<any>();
    const [items, setItems] = useState<IPendingLog[]>(pendingLogs ?? []);
    const [busy, setBusy] = useState(false);

    // A typed "yes" updates the card from the server; follow it.
    useEffect(() => {
        setItems(pendingLogs ?? []);
    }, [pendingLogs]);

    if (items.length === 0) return null;

    const waiting = items.filter(item => item.status === 'pending');

    const answer = async (accept: boolean) => {
        setBusy(true);
        let next = items;
        for (const item of waiting) {
            try {
                const updated = await confirmChatLog(messageId, item._id, accept);
                next = next.map(entry => (entry._id === item._id ? updated : entry));
            } catch (error: any) {
                recordError(error, 'LogProposalCard.answer');
                const code = error?.response?.data?.data?.code;
                Toast.show({
                    type: 'error',
                    text1: t('common.error'),
                    text2:
                        code === 'day_closed'
                            ? t('chatLogs.expired')
                            : code === 'medicine_missing'
                              ? t('chatLogs.medicineMissing')
                              : t('logs.common.saveFailed'),
                    position: 'bottom',
                });
            }
        }
        setItems(next);
        setBusy(false);
    };

    return (
        <View style={styles.card}>
            <Text style={[styles.title, globalStyles.fontBold]}>
                {waiting.length > 0 ? t('chatLogs.title') : t('chatLogs.titleDone')}
            </Text>

            {items.map(item => (
                <View key={item._id} style={styles.row}>
                    <View style={styles.rowIcon}>
                        <Lucide
                            name={item.status === 'saved' ? 'check' : 'clipboard-list'}
                            size={14}
                            color={item.status === 'saved' ? colors.vivaSuccess : colors.darkPurple}
                        />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={[styles.rowText, globalStyles.fontSemiBold]}>
                            {describePendingLog(item, t)}
                        </Text>
                        {item.status === 'saved' ? (
                            <TouchableOpacity
                                onPress={() => navigation.navigate(SCREEN_FOR[item.logType] ?? 'LogPicker')}
                                accessibilityRole="link"
                            >
                                <Text style={[styles.link, globalStyles.fontSemiBold]}>{t('chatLogs.savedView')}</Text>
                            </TouchableOpacity>
                        ) : null}
                        {item.status === 'dismissed' ? (
                            <Text style={[styles.muted, globalStyles.fontRegular]}>{t('chatLogs.notSaved')}</Text>
                        ) : null}
                        {item.status === 'needs_medicine' ? (
                            <TouchableOpacity onPress={() => navigation.navigate('MedicineLog')} accessibilityRole="link">
                                <Text style={[styles.link, globalStyles.fontSemiBold]}>
                                    {t('chatLogs.addMedicine')}
                                </Text>
                            </TouchableOpacity>
                        ) : null}
                    </View>
                </View>
            ))}

            {waiting.length > 0 ? (
                <View style={styles.buttons}>
                    <TouchableOpacity
                        style={[styles.button, styles.secondary]}
                        onPress={() => answer(false)}
                        disabled={busy}
                        accessibilityRole="button"
                    >
                        <Text style={[styles.secondaryText, globalStyles.fontBold]}>{t('chatLogs.no')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.button, styles.primary, busy && { opacity: 0.6 }]}
                        onPress={() => answer(true)}
                        disabled={busy}
                        accessibilityRole="button"
                    >
                        {busy ? (
                            <ActivityIndicator color={colors.white} size="small" />
                        ) : (
                            <Text style={[styles.primaryText, globalStyles.fontBold]}>{t('chatLogs.yes')}</Text>
                        )}
                    </TouchableOpacity>
                </View>
            ) : null}
        </View>
    );
};

const styles = StyleSheet.create({
    card: {
        marginTop: 10,
        backgroundColor: colors.white,
        borderWidth: 1.5,
        borderColor: colors.vivaBorder,
        borderRadius: 16,
        padding: 14,
        gap: 10,
    },
    title: {
        fontSize: 13,
        color: colors.vivaInk,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 10,
    },
    rowIcon: {
        width: 26,
        height: 26,
        borderRadius: 8,
        backgroundColor: colors.vivaTint,
        alignItems: 'center',
        justifyContent: 'center',
    },
    rowText: {
        fontSize: 13,
        color: colors.vivaInk,
        lineHeight: 19,
    },
    link: {
        fontSize: 12,
        color: colors.darkPurple,
        marginTop: 2,
    },
    muted: {
        fontSize: 12,
        color: colors.vivaMuted,
        marginTop: 2,
    },
    buttons: {
        flexDirection: 'row',
        gap: 10,
        marginTop: 2,
    },
    button: {
        flex: 1,
        borderRadius: 12,
        paddingVertical: 11,
        alignItems: 'center',
        justifyContent: 'center',
    },
    primary: {
        flex: 1.4,
        backgroundColor: colors.darkPurple,
    },
    primaryText: {
        fontSize: 13,
        color: colors.white,
    },
    secondary: {
        borderWidth: 1.5,
        borderColor: colors.vivaBorder,
        backgroundColor: colors.white,
    },
    secondaryText: {
        fontSize: 13,
        color: colors.vivaSubtle,
    },
});

export default LogProposalCard;
