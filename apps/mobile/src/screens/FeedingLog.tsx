import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useRoute } from '@react-navigation/native';
import {
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MaterialDesignIcons from '@react-native-vector-icons/material-design-icons';

import GradientButtonWithSlightRadius from '../components/GradientButtonWithSlightRadius';
import LogInfoBanner from '../components/infant/LogInfoBanner';
import LogSectionCard from '../components/infant/LogSectionCard';
import {
    FEEDING_TYPES,
    FOOD_REACTIONS,
    SIDES_FOR_TYPE,
    SIDE_LABEL_KEYS,
    WATER_INCREMENTS_ML,
} from '../data/infantFeedingData';
import { colors } from '../public/assets/colors';
import { globalStyles } from '../public/styles';
import { infantLogStyles } from '../public/styles/infantLogStyles';
import {
    IFeedEntry,
    ISolidEntry,
    InfantLogRouteParams,
    TFeedSide,
    TFeedingType,
} from '../types/infantLog.types';
import {
    isSixMonthsOrOlder,
    splitDuration,
    summariseFeeds,
} from '../utils/infantLogHelpers';

const EMPTY_FEED: IFeedEntry = { time: '', side: null, amount: '' };
const EMPTY_SOLID: ISolidEntry = { time: '', food: '' };

/**
 * Feeding Log (PRD 4.3).
 *
 * Two versions of the same screen, split at six months:
 *
 *  - under six months, one of three feeding types decides which fields each feed row
 *    offers — sides and minutes for the breast, millilitres for a bottle;
 *  - from six months, solids and water join the day and breastfeeding becomes a yes/no.
 *
 * The version is chosen from the child's date of birth, with the design's manual switch
 * kept at the foot of the screen. That switch is what lets the team review both layouts
 * from one test account, and lets a mother whose baby is feeding ahead of the calendar
 * use the log that matches her day.
 *
 * UI only — nothing here is persisted yet.
 */
const FeedingLog: React.FC = () => {
    const { t } = useTranslation();
    const route = useRoute();
    const params = (route.params ?? {}) as InfantLogRouteParams;

    const childName = params.childName?.trim() || t('infant.childFallback');

    const [showSolids, setShowSolids] = useState<boolean>(() =>
        isSixMonthsOrOlder(params.childDob),
    );

    // 0–6 months
    const [feedingType, setFeedingType] = useState<TFeedingType>(
        'exclusive_breastfeeding',
    );
    const [feeds, setFeeds] = useState<IFeedEntry[]>([{ ...EMPTY_FEED }]);

    // 6 months+
    const [stillBreastfeeding, setStillBreastfeeding] = useState<boolean | null>(null);
    const [solids, setSolids] = useState<ISolidEntry[]>([{ ...EMPTY_SOLID }]);
    const [reactions, setReactions] = useState<string[]>([]);
    const [waterMl, setWaterMl] = useState<number>(0);

    const summary = summariseFeeds(feeds);
    const gap = summary.longestGapMinutes === null
        ? t('infant.feeding.gapNone')
        : t('infant.feeding.gapValue', splitDuration(summary.longestGapMinutes));

    const updateFeed = (index: number, patch: Partial<IFeedEntry>) =>
        setFeeds((prev) =>
            prev.map((entry, i) => (i === index ? { ...entry, ...patch } : entry)),
        );

    const updateSolid = (index: number, patch: Partial<ISolidEntry>) =>
        setSolids((prev) =>
            prev.map((entry, i) => (i === index ? { ...entry, ...patch } : entry)),
        );

    const toggleReaction = (key: string) =>
        setReactions((prev) =>
            prev.includes(key) ? prev.filter((item) => item !== key) : [...prev, key],
        );

    /** Amount means minutes on the breast and millilitres in a bottle. */
    const amountPlaceholder = (side: TFeedSide | null): string =>
        side === 'bottle'
            ? t('infant.feeding.amountMl')
            : t('infant.feeding.amountMinutes');

    const renderAddMore = (onPress: () => void) => (
        <TouchableOpacity
            activeOpacity={0.7}
            onPress={onPress}
            style={infantLogStyles.addMore}
            accessibilityRole="button"
        >
            <MaterialDesignIcons name="plus" size={16} color={colors.darkPurple} />
            <Text style={[infantLogStyles.addMoreText, globalStyles.fontSemiBold]}>
                {t('infant.addMore')}
            </Text>
        </TouchableOpacity>
    );

    const renderUnderSixMonths = () => (
        <>
            <LogSectionCard
                title={t('infant.feeding.typeTitle')}
                caption={t('infant.feeding.typeCaption')}
            >
                {FEEDING_TYPES.map((option) => {
                    const selected = option.key === feedingType;

                    return (
                        <TouchableOpacity
                            key={option.key}
                            activeOpacity={0.8}
                            onPress={() => setFeedingType(option.key)}
                            accessibilityRole="radio"
                            accessibilityState={{ selected }}
                            style={[styles.optionRow, selected && styles.optionRowSelected]}
                        >
                            <View
                                style={[styles.radio, selected && styles.radioSelected]}
                            >
                                {selected && <View style={styles.radioDot} />}
                            </View>

                            <View style={styles.flex}>
                                <Text
                                    style={[styles.optionLabel, globalStyles.fontSemiBold]}
                                >
                                    {t(option.labelKey)}
                                </Text>
                                <Text
                                    style={[styles.optionHint, globalStyles.fontRegular]}
                                >
                                    {t(option.descriptionKey)}
                                </Text>
                            </View>
                        </TouchableOpacity>
                    );
                })}
            </LogSectionCard>

            <LogSectionCard title={t('infant.feeding.scheduleTitle')}>
                {feeds.map((entry, index) => (
                    <View key={index} style={styles.feedRow}>
                        <TextInput
                            value={entry.time}
                            onChangeText={(text) => updateFeed(index, { time: text })}
                            placeholder={t('infant.timePlaceholder')}
                            placeholderTextColor={colors.gray}
                            keyboardType="numbers-and-punctuation"
                            style={[
                                infantLogStyles.input,
                                styles.timeInput,
                                globalStyles.fontRegular,
                            ]}
                            accessibilityLabel={t('infant.timePlaceholder')}
                        />

                        <View style={styles.sideGroup}>
                            {SIDES_FOR_TYPE[feedingType].map((side) => {
                                const selected = entry.side === side;

                                return (
                                    <TouchableOpacity
                                        key={side}
                                        activeOpacity={0.8}
                                        onPress={() => updateFeed(index, { side })}
                                        accessibilityRole="radio"
                                        accessibilityState={{ selected }}
                                        style={styles.side}
                                    >
                                        <Text
                                            style={[
                                                styles.sideLabel,
                                                globalStyles.fontRegular,
                                            ]}
                                        >
                                            {t(SIDE_LABEL_KEYS[side])}
                                        </Text>
                                        <View
                                            style={[
                                                styles.radio,
                                                selected && styles.radioSelected,
                                            ]}
                                        >
                                            {selected && <View style={styles.radioDot} />}
                                        </View>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>

                        <TextInput
                            value={entry.amount}
                            onChangeText={(text) => updateFeed(index, { amount: text })}
                            placeholder={amountPlaceholder(entry.side)}
                            placeholderTextColor={colors.gray}
                            keyboardType="decimal-pad"
                            style={[
                                infantLogStyles.input,
                                styles.amountInput,
                                globalStyles.fontRegular,
                            ]}
                            accessibilityLabel={amountPlaceholder(entry.side)}
                        />
                    </View>
                ))}

                {renderAddMore(() => setFeeds((prev) => [...prev, { ...EMPTY_FEED }]))}
            </LogSectionCard>

            <LogSectionCard title={t('infant.feeding.todayTitle')}>
                <View style={infantLogStyles.row}>
                    <View style={infantLogStyles.stat}>
                        <Text
                            style={[infantLogStyles.statLabel, globalStyles.fontRegular]}
                        >
                            {t('infant.feeding.statFeeds')}
                        </Text>
                        <Text style={[infantLogStyles.statValue, globalStyles.fontBold]}>
                            {summary.feeds}
                        </Text>
                    </View>

                    <View style={infantLogStyles.stat}>
                        <Text
                            style={[infantLogStyles.statLabel, globalStyles.fontRegular]}
                        >
                            {t('infant.feeding.statLongestGap')}
                        </Text>
                        <Text style={[infantLogStyles.statValue, globalStyles.fontBold]}>
                            {gap}
                        </Text>
                    </View>
                </View>
            </LogSectionCard>
        </>
    );

    const renderSixMonthsPlus = () => (
        <>
            <LogInfoBanner
                icon="star-four-points-outline"
                text={t('infant.feeding.solidsBanner', { name: childName })}
            />

            <LogSectionCard title={t('infant.feeding.stillBreastfeedingTitle')}>
                <View style={infantLogStyles.row}>
                    {[true, false].map((value) => {
                        const selected = stillBreastfeeding === value;

                        return (
                            <TouchableOpacity
                                key={String(value)}
                                activeOpacity={0.8}
                                onPress={() => setStillBreastfeeding(value)}
                                accessibilityRole="radio"
                                accessibilityState={{ selected }}
                                style={[
                                    styles.choice,
                                    selected && styles.choiceSelected,
                                ]}
                            >
                                <Text
                                    style={[
                                        styles.choiceLabel,
                                        selected && styles.choiceLabelSelected,
                                        globalStyles.fontSemiBold,
                                    ]}
                                >
                                    {value
                                        ? t('infant.feeding.stillBreastfeedingYes')
                                        : t('infant.feeding.stillBreastfeedingNo')}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>
            </LogSectionCard>

            <LogSectionCard title={t('infant.feeding.solidsTitle')}>
                {solids.map((entry, index) => (
                    <View key={index} style={styles.solidRow}>
                        <TextInput
                            value={entry.time}
                            onChangeText={(text) => updateSolid(index, { time: text })}
                            placeholder={t('infant.timePlaceholder')}
                            placeholderTextColor={colors.gray}
                            keyboardType="numbers-and-punctuation"
                            style={[
                                infantLogStyles.input,
                                styles.timeInput,
                                globalStyles.fontRegular,
                            ]}
                            accessibilityLabel={t('infant.timePlaceholder')}
                        />

                        <TextInput
                            value={entry.food}
                            onChangeText={(text) => updateSolid(index, { food: text })}
                            placeholder={t('infant.feeding.foodPlaceholder')}
                            placeholderTextColor={colors.gray}
                            style={[infantLogStyles.input, globalStyles.fontRegular]}
                            accessibilityLabel={t('infant.feeding.foodPlaceholder')}
                        />
                    </View>
                ))}

                {renderAddMore(() => setSolids((prev) => [...prev, { ...EMPTY_SOLID }]))}

                <Text style={[styles.subheading, globalStyles.fontSemiBold]}>
                    {t('infant.feeding.reactionTitle')}
                </Text>

                <View style={styles.chipWrap}>
                    {FOOD_REACTIONS.map((reaction) => {
                        const selected = reactions.includes(reaction.key);

                        return (
                            <TouchableOpacity
                                key={reaction.key}
                                activeOpacity={0.8}
                                onPress={() => toggleReaction(reaction.key)}
                                accessibilityRole="checkbox"
                                accessibilityState={{ checked: selected }}
                                style={[
                                    styles.reaction,
                                    selected && styles.reactionSelected,
                                ]}
                            >
                                <Text
                                    style={[
                                        styles.reactionLabel,
                                        selected && styles.reactionLabelSelected,
                                        globalStyles.fontRegular,
                                    ]}
                                >
                                    {t(reaction.labelKey)}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>
            </LogSectionCard>

            <LogSectionCard
                title={t('infant.feeding.waterTitle')}
                headerRight={
                    waterMl > 0 ? (
                        <TouchableOpacity
                            activeOpacity={0.7}
                            onPress={() => setWaterMl(0)}
                            accessibilityRole="button"
                        >
                            <Text
                                style={[
                                    infantLogStyles.linkText,
                                    globalStyles.fontSemiBold,
                                ]}
                            >
                                {t('infant.feeding.waterReset')}
                            </Text>
                        </TouchableOpacity>
                    ) : undefined
                }
            >
                <View style={styles.waterTotalRow}>
                    <Text style={[styles.waterTotal, globalStyles.fontBold]}>
                        {waterMl}
                    </Text>
                    <Text style={[styles.waterUnit, globalStyles.fontRegular]}>
                        {t('infant.feeding.waterToday')}
                    </Text>
                </View>

                <Text style={[infantLogStyles.caption, globalStyles.fontRegular]}>
                    {t('infant.feeding.waterCaption')}
                </Text>

                <View style={styles.waterButtons}>
                    {WATER_INCREMENTS_ML.map((amount) => (
                        <TouchableOpacity
                            key={amount}
                            activeOpacity={0.8}
                            onPress={() => setWaterMl((prev) => prev + amount)}
                            accessibilityRole="button"
                            style={styles.waterButton}
                        >
                            <Text
                                style={[
                                    styles.waterButtonLabel,
                                    globalStyles.fontSemiBold,
                                ]}
                            >
                                {t('infant.feeding.waterIncrement', { amount })}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </LogSectionCard>
        </>
    );

    return (
        <SafeAreaView style={infantLogStyles.screen} edges={['bottom', 'left', 'right']}>
            <KeyboardAvoidingView
                style={styles.flex}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
                <ScrollView
                    contentContainerStyle={infantLogStyles.content}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                >
                    {showSolids ? renderSixMonthsPlus() : renderUnderSixMonths()}

                    <GradientButtonWithSlightRadius
                        title={t('infant.saveLog')}
                        onPress={() => undefined}
                        fullRounded
                        fullWidth
                    />

                    <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={() => setShowSolids((prev) => !prev)}
                        style={infantLogStyles.linkButton}
                        accessibilityRole="button"
                    >
                        <Text
                            style={[infantLogStyles.linkText, globalStyles.fontSemiBold]}
                        >
                            {showSolids
                                ? t('infant.feeding.backToUnderSix')
                                : t('infant.feeding.previewSixPlus')}
                        </Text>
                    </TouchableOpacity>

                    <Text
                        style={[
                            infantLogStyles.footnote,
                            styles.centered,
                            globalStyles.fontRegular,
                        ]}
                    >
                        {t('infant.notPersistedYet')}
                    </Text>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    flex: {
        flex: 1,
    },

    centered: {
        textAlign: 'center',
    },

    optionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 12,
        padding: 14,
        marginBottom: 10,
    },

    optionRowSelected: {
        borderColor: colors.darkPurple,
        backgroundColor: colors.lightPurple,
    },

    optionLabel: {
        fontSize: 15,
        color: colors.black,
    },

    optionHint: {
        marginTop: 2,
        fontSize: 12,
        color: colors.darkGray,
    },

    radio: {
        width: 20,
        height: 20,
        borderRadius: 10,
        borderWidth: 2,
        borderColor: colors.mediumGray,
        alignItems: 'center',
        justifyContent: 'center',
    },

    radioSelected: {
        borderColor: colors.darkPurple,
    },

    radioDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: colors.darkPurple,
    },

    feedRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginBottom: 12,
    },

    solidRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginBottom: 12,
    },

    timeInput: {
        flex: 0,
        width: 86,
    },

    amountInput: {
        flex: 0,
        width: 72,
    },

    sideGroup: {
        flex: 1,
        flexDirection: 'row',
        justifyContent: 'space-around',
        gap: 6,
    },

    side: {
        alignItems: 'center',
        gap: 4,
    },

    sideLabel: {
        fontSize: 11,
        color: colors.darkGray,
    },

    choice: {
        flex: 1,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 12,
        paddingVertical: 16,
        paddingHorizontal: 12,
        alignItems: 'center',
    },

    choiceSelected: {
        borderColor: colors.darkPurple,
        backgroundColor: colors.lightPurple,
    },

    choiceLabel: {
        fontSize: 14,
        textAlign: 'center',
        color: colors.darkGray,
    },

    choiceLabelSelected: {
        color: colors.darkPurple,
    },

    subheading: {
        marginTop: 18,
        marginBottom: 10,
        fontSize: 13,
        color: colors.black,
    },

    chipWrap: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
    },

    reaction: {
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 20,
        paddingHorizontal: 16,
        paddingVertical: 9,
    },

    reactionSelected: {
        borderColor: colors.darkPurple,
        backgroundColor: colors.lightPurple,
    },

    reactionLabel: {
        fontSize: 13,
        color: colors.darkGray,
    },

    reactionLabelSelected: {
        color: colors.darkPurple,
    },

    waterTotalRow: {
        flexDirection: 'row',
        alignItems: 'baseline',
        gap: 6,
    },

    waterTotal: {
        fontSize: 34,
        color: colors.black,
    },

    waterUnit: {
        fontSize: 14,
        color: colors.darkGray,
    },

    waterButtons: {
        flexDirection: 'row',
        gap: 10,
        marginTop: 14,
    },

    waterButton: {
        flex: 1,
        borderWidth: 1,
        borderColor: colors.purple,
        borderRadius: 10,
        paddingVertical: 12,
        alignItems: 'center',
    },

    waterButtonLabel: {
        fontSize: 14,
        color: colors.darkPurple,
    },
});

export default FeedingLog;
