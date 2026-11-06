import React from 'react';
import { Linking, Text, TouchableOpacity, View } from 'react-native';
import Lucide from '@react-native-vector-icons/lucide';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { CareRoute } from '@vivamama/care-schedules';

import { recordError } from '../../analytics';
import { RememberAction } from '../../data/journey/journeyTypes';
import { useDailyCounter } from '../../hooks/useDailyCounter';
import { colors } from '../../public/assets/colors';
import { globalStyles } from '../../public/styles';
import { journeyStyles as styles } from '../../public/styles/journeyStyles';
import { JourneyPosition } from '../../utils/journeyPosition';
import { useCardWidth } from './CardRail';

type Placed = Extract<JourneyPosition, { kind: 'pregnant' | 'postpartum' }>;
type IconName = React.ComponentProps<typeof Lucide>['name'];

const KICK_MAX = 200;
const EMERGENCY_NUMBER = '108';

/** Where a row opens. `kicks` and `call` are handled on the row; `tick` is a note to read. */
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

const ICONS: Record<Exclude<RememberAction, 'kicks'>, IconName> = {
    medicine: 'pill',
    reminders: 'bell',
    mood: 'smile',
    records: 'upload',
    summary: 'share-2',
    library: 'book-open',
    experts: 'users',
    chat: 'message-circle',
    call: 'phone',
    tick: 'info',
};

/** Logs on the daily kick count the Kick Counter uses, so both show one number. */
const KickRow: React.FC<{ label: string }> = ({ label }) => {
    const { t } = useTranslation();
    const { value, increment } = useDailyCounter('kicks', KICK_MAX);

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

    const side = route === 'private' ? 'private' : 'govt';
    const actions = position.row.remember[side];
    const lines = content(`mother.${rowId}.remember.${side}`, { returnObjects: true });
    const texts = Array.isArray(lines) ? (lines as unknown as string[]) : [];

    const open = (action: RememberAction) => {
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
                <Text style={[styles.cardLabel, { color: colors.journeyRememberText }, globalStyles.fontSemiBold]}>
                    {t('journey.remember.title')}
                </Text>
                <Text style={[styles.cardHeading, globalStyles.fontBold]}>{t('journey.remember.heading')}</Text>

                {actions.map((action, index) => {
                    if (action === 'kicks') return <KickRow key={index} label={texts[index] ?? ''} />;

                    const row = (
                        <>
                            <View style={styles.tileIcon}>
                                <Lucide name={ICONS[action]} size={16} color={colors.journeyRememberText} />
                            </View>
                            <View style={styles.tileBody}>
                                <Text style={[styles.tileText, globalStyles.fontSemiBold]}>{texts[index]}</Text>
                            </View>
                        </>
                    );

                    // A note such as "Take your MCP card" opens nothing, so it is not a button.
                    if (action === 'tick') {
                        return (
                            <View key={index} style={styles.tile}>
                                {row}
                            </View>
                        );
                    }

                    return (
                        <TouchableOpacity
                            key={index}
                            style={styles.tile}
                            onPress={() => open(action)}
                            accessibilityRole="button"
                        >
                            {row}
                            <Lucide name="chevron-right" size={16} color={colors.journeyMuted} />
                        </TouchableOpacity>
                    );
                })}
            </View>
        </View>
    );
};

export default RememberCard;
