import React, { useCallback, useEffect, useState } from 'react';
import { Linking, Text, TouchableOpacity, View } from 'react-native';
import Lucide from '@react-native-vector-icons/lucide';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { CareRoute } from '@vivamama/care-schedules';

import { recordError } from '../../analytics';
import { useAuth } from '../../context/AuthContext';
import { RememberAction } from '../../data/journey/journeyTypes';
import { useDailyCounter } from '../../hooks/useDailyCounter';
import { colors } from '../../public/assets/colors';
import { globalStyles } from '../../public/styles';
import { journeyStyles as styles } from '../../public/styles/journeyStyles';
import { JourneyPosition } from '../../utils/journeyPosition';
import { todayKey } from '../../utils/motherLogHelpers';
import { useCardWidth } from './CardRail';

type Placed = Extract<JourneyPosition, { kind: 'pregnant' | 'postpartum' }>;

const KICK_GOAL = 10;
const KICK_MAX = 200;
const EMERGENCY_NUMBER = '108';

/** Where a tile opens. `kicks`, `call` and `tick` are handled on the tile itself. */
const SCREENS: Partial<Record<RememberAction, string>> = {
    medicine: 'MedicineLog',
    reminders: 'Reminders',
    mood: 'MoodLog',
    records: 'RecordsUpload',
    summary: 'HealthSummary',
    library: 'Library',
    experts: 'Experts',
    chat: 'ChatWithVivaAI',
};

const storageKey = (userId: string | null | undefined) => `journey.remember.${userId ?? 'anon'}`;

/**
 * Today's ticks on this device, one record per user. It holds only the current row and day,
 * so nothing builds up. The counter is encouragement, not a medical record, so it does not
 * need the server; the logs a tile opens are saved there as usual.
 */
const useTodaysTicks = (rowId: string) => {
    const { userId } = useAuth();
    const [ticks, setTicks] = useState<number[]>([]);

    useEffect(() => {
        let cancelled = false;
        AsyncStorage.getItem(storageKey(userId))
            .then((stored: string | null) => {
                if (cancelled) return;
                const saved = stored ? JSON.parse(stored) : null;
                setTicks(saved?.day === todayKey() && saved?.rowId === rowId ? saved.ticks : []);
            })
            .catch((error: unknown) => recordError(error, 'RememberCard.loadTicks'));
        return () => {
            cancelled = true;
        };
    }, [rowId, userId]);

    const save = useCallback(
        (next: number[]) => {
            setTicks(next);
            AsyncStorage.setItem(storageKey(userId), JSON.stringify({ day: todayKey(), rowId, ticks: next })).catch(
                (error: unknown) => recordError(error, 'RememberCard.saveTicks'),
            );
        },
        [rowId, userId],
    );

    return { ticks, save };
};

/** Logs on the daily kick count the Kick Counter uses, so both show one number. */
const KickTile: React.FC<{ label: string; goal: number; onDone: (done: boolean) => void }> = ({ label, goal, onDone }) => {
    const { t } = useTranslation();
    const { value, increment } = useDailyCounter('kicks', KICK_MAX);

    useEffect(() => {
        onDone(value >= goal);
    }, [value, goal, onDone]);

    return (
        <View style={styles.tile}>
            <TouchableOpacity
                style={styles.kickButton}
                onPress={increment}
                accessibilityRole="button"
                accessibilityLabel={t('journey.remember.logKick')}
            >
                <Text style={[styles.kickCount, globalStyles.fontBold]}>{value}</Text>
            </TouchableOpacity>
            <View style={styles.tileBody}>
                <Text style={[styles.tileText, globalStyles.fontSemiBold]}>{label}</Text>
                <Text style={[styles.tileSub, globalStyles.fontRegular]}>{t('journey.remember.tapEachKick')}</Text>
            </View>
        </View>
    );
};

/** Card 3: one reminder, one log and one record or Viva action for this row. */
const RememberCard: React.FC<{ position: Placed; route: CareRoute }> = ({ position, route }) => {
    const { t } = useTranslation();
    const { t: content } = useTranslation('journeyContent');
    const navigation = useNavigation<any>();
    const width = useCardWidth();
    const rowId = position.row.id;
    const { ticks, save } = useTodaysTicks(rowId);
    const [kicksDone, setKicksDone] = useState(false);

    const side = route === 'private' ? 'private' : 'govt';
    const actions = position.row.remember[side];
    const lines = content(`mother.${rowId}.remember.${side}`, { returnObjects: true });
    const texts = Array.isArray(lines) ? (lines as unknown as string[]) : [];

    const isDone = (index: number) => (actions[index] === 'kicks' ? kicksDone : ticks.includes(index));
    const doneCount = actions.filter((_, index) => isDone(index)).length;

    const press = (index: number, action: RememberAction) => {
        const already = ticks.includes(index);
        // A plain tick can be undone; opening a screen simply counts as having gone there.
        if (action === 'tick') {
            save(already ? ticks.filter(tick => tick !== index) : [...ticks, index]);
            return;
        }
        if (!already) save([...ticks, index]);

        if (action === 'call') {
            Linking.openURL(`tel:${EMERGENCY_NUMBER}`).catch(error => recordError(error, 'RememberCard.call'));
            return;
        }
        const screen = SCREENS[action];
        if (screen) navigation.navigate(screen);
    };

    return (
        <View style={[styles.card, { width, backgroundColor: colors.journeyRememberBG }]}>
            <View style={[styles.cardPad, { gap: 8 }]}>
                <View style={styles.rememberTop}>
                    <Text style={[styles.cardLabel, { color: colors.journeyRememberText }, globalStyles.fontSemiBold]}>
                        {t('journey.remember.title')}
                    </Text>
                    <View style={styles.countPill}>
                        <Text style={[styles.countText, globalStyles.fontBold]}>
                            {t('journey.remember.count', { done: doneCount, total: actions.length })}
                        </Text>
                    </View>
                </View>
                <Text style={[styles.cardHeading, globalStyles.fontBold]}>{t('journey.remember.heading')}</Text>

                {actions.map((action, index) =>
                    action === 'kicks' ? (
                        <KickTile
                            key={index}
                            label={texts[index] ?? ''}
                            // "Log baby moved" on the government route is one tap; "Log 10 kicks" is ten.
                            goal={route === 'private' ? KICK_GOAL : 1}
                            onDone={setKicksDone}
                        />
                    ) : (
                        <TouchableOpacity
                            key={index}
                            style={styles.tile}
                            onPress={() => press(index, action)}
                            accessibilityRole={action === 'tick' ? 'checkbox' : 'button'}
                            accessibilityState={{ checked: isDone(index) }}
                        >
                            <View style={[styles.tileBox, isDone(index) && styles.tileBoxDone]}>
                                {isDone(index) ? <Lucide name="check" size={16} color={colors.white} /> : null}
                            </View>
                            <View style={styles.tileBody}>
                                <Text style={[styles.tileText, globalStyles.fontSemiBold]}>{texts[index]}</Text>
                            </View>
                        </TouchableOpacity>
                    ),
                )}
            </View>
        </View>
    );
};

export default RememberCard;
