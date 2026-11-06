import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    useWindowDimensions,
} from 'react-native';
import Lucide from '@react-native-vector-icons/lucide';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';

import { FLOW_SLUGS } from '../../constants/chat';
import { BABY_LOG_TILES, getMainTiles, PRIVATE_ALSO_TRACK_TILES } from '../../data/logPickerData';
import { REMINDER_CATEGORIES } from '../../data/reminderCategories';
import { useCareContext } from '../../hooks/useCareContext';
import { useCareManagerBooking } from '../../hooks/useCareManagerBooking';
import { colors } from '../../public/assets/colors';
import { globalStyles } from '../../public/styles';
import { FlowType } from '../../types/chat.types';
import { CareModelEnum, DeliveryOutcomeEnum, UserCategoryEnum } from '../../types/user.types';
import { infantLogParams } from '../../utils/childAge';
import BottomSheetModal from '../chatAttachments/BottomSheetModal';
import BookingConfirmedModal from '../consultation/BookingConfirmedModal';
import ConsultationBookingSheet from '../consultation/ConsultationBookingSheet';
import ChildAvatarStrip from '../dashboard/ChildAvatarStrip';
import CareModelPrompt from '../logs/CareModelPrompt';
import SegmentedToggle from '../logs/SegmentedToggle';

type Sheet = 'log' | 'reminders' | 'records' | 'experts';
type IconName = React.ComponentProps<typeof Lucide>['name'];

const SHEET_MAX_HEIGHT = 0.72;
const SHEET_PADDING = 20;
const TILE_GAP = 8;
const TILE_COLUMNS = 3;
const TILE_COLORS = [colors.vivaTrack, colors.vivaMoodBG, colors.journeyTealBG, colors.journeyRememberBG];

const TRIGGERS: { key: Sheet; labelKey: string; icon: IconName; bg: string; fg: string }[] = [
    { key: 'log', labelKey: 'vivaHub.triggers.log', icon: 'plus', bg: colors.journeyTealBG, fg: colors.journeyTealText },
    { key: 'reminders', labelKey: 'vivaHub.triggers.reminders', icon: 'bell', bg: colors.journeyRememberBG, fg: colors.journeyRememberText },
    { key: 'records', labelKey: 'vivaHub.triggers.records', icon: 'folder-heart', bg: colors.vivaMoodBG, fg: colors.journeyRecordsText },
    { key: 'experts', labelKey: 'vivaHub.triggers.experts', icon: 'user-round', bg: colors.vivaTrack, fg: colors.darkPurple },
];

interface DrawerTile {
    key: string;
    label: string;
    icon: string;
    onPress: () => void;
}

/** Three coloured tiles to a row, with the icon above the label. */
const TileGrid: React.FC<{ tiles: DrawerTile[] }> = ({ tiles }) => {
    const { width } = useWindowDimensions();
    const tileWidth = (width - SHEET_PADDING * 2 - TILE_GAP * (TILE_COLUMNS - 1)) / TILE_COLUMNS;

    return (
        <View style={styles.tileGrid}>
            {tiles.map(({ key, label, icon, onPress }, index) => (
                <TouchableOpacity
                    key={key}
                    style={[styles.tile, { width: tileWidth, backgroundColor: TILE_COLORS[index % TILE_COLORS.length] }]}
                    onPress={onPress}
                    accessibilityRole="button"
                >
                    <Lucide name={icon as IconName} size={24} color={colors.vivaMchText} />
                    <Text style={[styles.tileLabel, globalStyles.fontSemiBold]}>{label}</Text>
                </TouchableOpacity>
            ))}
        </View>
    );
};

/** A full-width option with the icon beside a title and a line of detail. */
const DrawerRow: React.FC<{ label: string; sub: string; icon: IconName; onPress: () => void }> = ({
    label,
    sub,
    icon,
    onPress,
}) => (
    <TouchableOpacity style={styles.row} onPress={onPress} accessibilityRole="button">
        <Lucide name={icon} size={22} color={colors.darkPurple} />
        <View style={styles.rowBody}>
            <Text style={[styles.rowLabel, globalStyles.fontSemiBold]}>{label}</Text>
            <Text style={[styles.rowSub, globalStyles.fontRegular]}>{sub}</Text>
        </View>
    </TouchableOpacity>
);

interface ChatTriggersProps {
    /** Hidden once she has written something, in step with the mic. */
    hidden?: boolean;
}

/**
 * The buttons attached to the top of the Viva chat box, which replaced the Viva AI hub.
 * Each opens a drawer of what the app already offers, and each option opens its screen.
 * Stays mounted while hidden, so an open booking sheet survives a change in the box.
 */
const ChatTriggers: React.FC<ChatTriggersProps> = ({ hidden = false }) => {
    const { t } = useTranslation();
    const navigation = useNavigation<any>();
    const { height } = useWindowDimensions();
    const { careModel, category, deliveryOutcome, children, loading } = useCareContext();

    const [sheet, setSheet] = useState<Sheet | null>(null);
    const [logFor, setLogFor] = useState<'me' | 'baby'>('me');
    const [childId, setChildId] = useState<string | undefined>();
    const [showBooking, setShowBooking] = useState(false);
    const [showBooked, setShowBooked] = useState(false);

    const { credits, hasCredit, fee, loading: booking, book } = useCareManagerBooking(() => setShowBooked(true));

    const selectedChild = children.find(child => child._id === childId) ?? children[0];
    const afterLoss = deliveryOutcome === DeliveryOutcomeEnum.STILL_BIRTH;
    // Hidden only after a loss with no other child, so she is not shown baby options.
    const showBabySide = children.length > 0 || !afterLoss;

    useEffect(() => {
        if (!showBabySide) setLogFor('me');
    }, [showBabySide]);

    const close = () => setSheet(null);

    // Closes first: a Modal would otherwise stay on top of the screen it opened.
    const go = (screen: string, params?: object) => {
        close();
        navigation.navigate(screen, params);
    };

    const addBaby = () => go('ChatWithVivaAI', { flowSlug: FLOW_SLUGS[FlowType.BABY_ONBOARDING] });

    const titles: Record<Sheet, string> = {
        log: t('logs.picker.title'),
        reminders: t('logs.reminders.whatReminded'),
        records: t('vivaHub.triggers.recordsTitle'),
        experts: t('vivaHub.triggers.experts'),
    };

    const myTiles: DrawerTile[] = careModel
        ? [
              ...getMainTiles(careModel, category),
              ...(careModel === CareModelEnum.PRIVATE ? PRIVATE_ALSO_TRACK_TILES : []),
          ].map(tile => ({
              key: tile.key,
              label: t(`logs.picker.${tile.labelKey}`),
              icon: tile.icon,
              onPress: () => go(tile.screen),
          }))
        : [];

    const babyTiles: DrawerTile[] = BABY_LOG_TILES.map(tile => ({
        key: tile.key,
        label: t(`nav.${tile.labelKey}`),
        icon: tile.icon,
        onPress: () => go(tile.screen, infantLogParams(selectedChild)),
    }));

    const reminderTiles: DrawerTile[] = REMINDER_CATEGORIES.map(({ key, icon }) => ({
        key,
        label: t(`logs.reminders.categories.${key}`),
        icon,
        onPress: () => go('Reminders', { category: key }),
    }));

    return (
        <>
            {!hidden ? (
                <View style={styles.triggerRow}>
                    {TRIGGERS.map(({ key, labelKey, icon, bg, fg }) => (
                        <TouchableOpacity
                            key={key}
                            style={[styles.trigger, { backgroundColor: bg }]}
                            onPress={() => setSheet(key)}
                            accessibilityRole="button"
                        >
                            <Lucide name={icon} size={18} color={fg} />
                            <Text style={[styles.triggerText, { color: fg }, globalStyles.fontSemiBold]} numberOfLines={1}>
                                {t(labelKey)}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>
            ) : null}

            <BottomSheetModal
                visible={sheet !== null}
                onClose={close}
                large
                accessibilityLabel={sheet ? titles[sheet] : undefined}
            >
                {sheet ? (
                    <ScrollView style={{ maxHeight: height * SHEET_MAX_HEIGHT }} contentContainerStyle={styles.sheetContent}>
                        <Text style={[styles.title, globalStyles.fontBold]} accessibilityRole="header">
                            {titles[sheet]}
                        </Text>

                        {sheet === 'log' ? (
                            <>
                                {showBabySide ? (
                                    <View style={styles.toggle}>
                                        <SegmentedToggle
                                            value={logFor}
                                            onChange={setLogFor}
                                            options={[
                                                { key: 'me', label: t('vivaHub.triggers.forMe') },
                                                { key: 'baby', label: t('vivaHub.triggers.forBaby') },
                                            ]}
                                        />
                                    </View>
                                ) : null}

                                {logFor === 'me' && loading ? <ActivityIndicator color={colors.darkPurple} /> : null}
                                {logFor === 'me' && !loading && !careModel ? <CareModelPrompt onLeave={close} /> : null}
                                {logFor === 'me' && !loading && careModel ? <TileGrid tiles={myTiles} /> : null}

                                {logFor === 'baby' && children.length === 0 && category === UserCategoryEnum.NP ? (
                                    <Text style={[styles.rowSub, globalStyles.fontRegular]}>
                                        {t('vivaHub.triggers.babyLogsAfterBirth')}
                                    </Text>
                                ) : null}

                                {logFor === 'baby' && children.length === 0 && category !== UserCategoryEnum.NP ? (
                                    <TileGrid
                                        tiles={[{ key: 'addBaby', label: t('infant.emptyCta'), icon: 'baby', onPress: addBaby }]}
                                    />
                                ) : null}

                                {logFor === 'baby' && children.length > 0 ? (
                                    <>
                                        {children.length > 1 ? (
                                            <ChildAvatarStrip
                                                childList={children}
                                                selectedChildId={selectedChild?._id}
                                                onSelectChild={setChildId}
                                                onAddChild={addBaby}
                                            />
                                        ) : null}
                                        <TileGrid tiles={babyTiles} />
                                    </>
                                ) : null}
                            </>
                        ) : null}

                        {sheet === 'reminders' ? (
                            <>
                                <TileGrid tiles={reminderTiles} />
                                <DrawerRow
                                    icon="bell"
                                    label={t('vivaHub.triggers.myReminders')}
                                    sub={t('vivaHub.triggers.myRemindersSub')}
                                    onPress={() => go('Reminders')}
                                />
                            </>
                        ) : null}

                        {sheet === 'records' ? (
                            <>
                                <DrawerRow
                                    icon="upload"
                                    label={t('vivaHub.uploadRecords')}
                                    sub={t('vivaHub.triggers.uploadSub')}
                                    onPress={() => go('RecordsUpload')}
                                />
                                <DrawerRow
                                    icon="folder-heart"
                                    label={t('healthRecords.title')}
                                    sub={t('vivaHub.triggers.myRecordsSub')}
                                    onPress={() => go('HealthRecords')}
                                />
                                <DrawerRow
                                    icon="file-text"
                                    label={t('healthSummary.title')}
                                    sub={t('vivaHub.triggers.summarySub')}
                                    onPress={() => go('HealthSummary')}
                                />
                            </>
                        ) : null}

                        {sheet === 'experts' ? (
                            <>
                                <DrawerRow
                                    icon="stethoscope"
                                    label={t('dashboard.floatingMenuBrowse')}
                                    sub={t('dashboard.floatingMenuBrowseDesc')}
                                    onPress={() => go('DashboardTabNavigator', { screen: 'Experts' })}
                                />
                                <DrawerRow
                                    icon="message-circle-heart"
                                    label={t('dashboard.floatingMenuCounsellor')}
                                    sub={t('dashboard.floatingMenuCounsellorDesc')}
                                    onPress={() => {
                                        close();
                                        setShowBooking(true);
                                    }}
                                />
                            </>
                        ) : null}
                    </ScrollView>
                ) : null}
            </BottomSheetModal>

            <ConsultationBookingSheet
                visible={showBooking}
                onClose={() => setShowBooking(false)}
                onConfirm={async (date, slot) => {
                    setShowBooking(false);
                    await book(date, slot);
                }}
                title={t('careManager.requestCallTitle')}
                credits={credits}
                feeAmount={fee}
                confirmLabel={
                    hasCredit
                        ? t('careManager.requestWithCredit', { count: credits })
                        : fee
                            ? t('careManager.requestWithFee', { amount: fee })
                            : t('careManager.requestCallback')
                }
                submitting={booking}
            />
            <BookingConfirmedModal visible={showBooked} onDismiss={() => setShowBooked(false)} />
        </>
    );
};

const styles = StyleSheet.create({
    triggerRow: { flexDirection: 'row', gap: 6, paddingHorizontal: 12, paddingTop: 8 },
    trigger: {
        flex: 1,
        minHeight: 58,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        paddingHorizontal: 2,
    },
    triggerText: { fontSize: 11.5 },
    sheetContent: { gap: 12, paddingBottom: 8 },
    title: { fontSize: 20, color: colors.vivaInk },
    // Full width: the options flex to share the track, so a track sized to them collapses.
    toggle: { alignSelf: 'stretch' },
    tileGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: TILE_GAP },
    tile: {
        minHeight: 84,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 5,
        paddingVertical: 6,
        paddingHorizontal: 4,
    },
    tileLabel: { fontSize: 11.5, lineHeight: 14, color: colors.vivaInk, textAlign: 'center' },
    row: {
        minHeight: 60,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        borderWidth: 1,
        borderColor: colors.vivaMchBorder,
        borderRadius: 14,
        backgroundColor: colors.vivaBG,
        paddingVertical: 10,
        paddingHorizontal: 14,
    },
    rowBody: { flex: 1 },
    rowLabel: { fontSize: 14, color: colors.vivaInk },
    rowSub: { fontSize: 11.5, lineHeight: 16, color: colors.journeyMuted, marginTop: 1 },
});

export default ChatTriggers;
