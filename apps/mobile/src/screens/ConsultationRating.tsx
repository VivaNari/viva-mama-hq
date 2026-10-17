import Lucide from '@react-native-vector-icons/lucide';
import { useNavigation, useRoute } from '@react-navigation/native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    ActivityIndicator,
    Image,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { AirbnbRating } from 'react-native-ratings';
import { SafeAreaView } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { getConsultationReviewContext } from '../api/getConsultationReviewContext';
import { submitConsultationReview } from '../api/submitConsultationReview';
import { AnalyticsEvent, recordError, track } from '../analytics';
import GradientButtonWithSlightRadius from '../components/GradientButtonWithSlightRadius';
import { colors } from '../public/assets/colors';
import { globalStyles } from '../public/styles';
import {
    ConsultationReviewContext,
    ConsultationReviewContextResponse,
    SubmitConsultationReviewResponse,
} from '../types/consultation-review.types';
import { ConsultationTypeEnum } from '../types/consultation.types';

/** Free-text cap, generous enough for a paragraph without becoming an essay box. */
const REVIEW_MAX_LENGTH = 500;

/** How long the success state stays up before the screen closes itself. */
const AUTO_DISMISS_MS = 2200;

/** Index-aligned with the 1–5 stars. */
const RATING_KEYS = ['terrible', 'bad', 'ok', 'good', 'great'] as const;

/**
 * Quick picks, so a rating can carry a reason without anyone having to type. Which
 * set is offered follows the stars: praise makes no sense under two stars, and
 * asking what went wrong after five stars reads as an accusation.
 */
const POSITIVE_TAG_KEYS = [
    'listened',
    'clearAdvice',
    'feltSupported',
    'onTime',
    'knowledgeable',
];

const IMPROVEMENT_TAG_KEYS = [
    'rushed',
    'unclear',
    'audioIssues',
    'lateStart',
    'notPersonal',
];

const POSITIVE_RATING_THRESHOLD = 4;

const formatSessionDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
    });

/** Two initials for the photo-less case — care managers rarely have an image. */
const initialsOf = (name: string) =>
    name
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map(part => part.charAt(0).toUpperCase())
        .join('');

const ConsultationRating = () => {
    const { t } = useTranslation();
    const navigation = useNavigation<any>();
    const route = useRoute() as any;
    const consultationId: string | undefined = route.params?.consultationId;

    const [context, setContext] = useState<ConsultationReviewContext | null>(null);
    const [contextLoading, setContextLoading] = useState(Boolean(consultationId));
    const [contextFailed, setContextFailed] = useState(false);

    const [rating, setRating] = useState(0);
    const [review, setReview] = useState('');
    const [selectedTags, setSelectedTags] = useState<string[]>([]);
    const [inputFocused, setInputFocused] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    // Covers both outcomes that end the form: a rating just submitted, and one the
    // server says already exists.
    const [done, setDone] = useState(false);

    const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const goBack = useCallback(() => {
        // Tapping the button while the auto-dismiss is pending would otherwise leave the
        // timer to fire and pop a second screen.
        if (dismissTimer.current) {
            clearTimeout(dismissTimer.current);
            dismissTimer.current = null;
        }
        if (navigation.canGoBack()) {
            navigation.goBack();
        } else {
            // Opened cold from a push notification — there is no screen behind this one.
            navigation.navigate('DashboardTabNavigator');
        }
    }, [navigation]);

    const loadContext = useCallback(async () => {
        if (!consultationId) {
            setContextLoading(false);
            return;
        }
        setContextLoading(true);
        setContextFailed(false);
        try {
            const response = (await getConsultationReviewContext(
                consultationId,
            )) as ConsultationReviewContextResponse;

            if (response?.success && response.data) {
                setContext(response.data);
                if (response.data.alreadyReviewed) {
                    setRating(response.data.existingRating ?? 0);
                    setDone(true);
                }
            } else {
                setContextFailed(true);
            }
        } catch (error) {
            // A missing name is a downgrade, not a blocker: the rating itself is still
            // worth collecting, so the form stays usable without it.
            console.error('Error loading consultation review context:', error);
            setContextFailed(true);
        } finally {
            setContextLoading(false);
        }
    }, [consultationId]);

    useEffect(() => {
        loadContext();
    }, [loadContext]);

    useEffect(
        () => () => {
            if (dismissTimer.current) clearTimeout(dismissTimer.current);
        },
        [],
    );

    const consultator = context?.consultator ?? null;

    /** "Postpartum Counsellor", or the expert's own speciality where there is one. */
    const consultatorRole = useMemo(() => {
        if (!context) return null;
        if (context.consultationType === ConsultationTypeEnum.CARE_MANAGER) {
            return t('consultation.careManager');
        }
        return consultator?.speciality || t('consultation.expert');
    }, [context, consultator, t]);

    const tagKeys = rating >= POSITIVE_RATING_THRESHOLD ? POSITIVE_TAG_KEYS : IMPROVEMENT_TAG_KEYS;

    const toggleTag = (key: string) => {
        setSelectedTags(current =>
            current.includes(key) ? current.filter(item => item !== key) : [...current, key],
        );
    };

    const handleRating = (value: number) => {
        setRating(value);
        // The chips on screen change meaning when the score crosses the threshold, so a
        // selection made under the old set must not ride along silently.
        const crossesThreshold =
            value >= POSITIVE_RATING_THRESHOLD !== rating >= POSITIVE_RATING_THRESHOLD;
        if (crossesThreshold) setSelectedTags([]);
    };

    const ratingLabel = rating > 0 ? t(`consultationRating.ratings.${RATING_KEYS[rating - 1]}`) : '';

    const ratingTone = useMemo(() => {
        if (rating >= 4) return { bg: colors.greenBadgeBG, text: colors.greenBadgeText };
        if (rating === 3) return { bg: colors.yellowBadgeBG, text: colors.yellowBadgeText };
        return { bg: colors.redBadgeBG, text: colors.redBadgeText };
    }, [rating]);

    const submitReview = async () => {
        if (!consultationId || rating === 0 || submitting) return;

        setSubmitting(true);
        try {
            // Tags ride along on the free-text field the API already accepts, so a user
            // who taps chips and types nothing still sends something readable.
            const tagLine = selectedTags.map(key => t(`consultationRating.tags.${key}`)).join(', ');
            const payload = [tagLine, review.trim()].filter(Boolean).join('\n');

            const response = (await submitConsultationReview(
                consultationId,
                rating,
                payload,
            )) as SubmitConsultationReviewResponse;

            if (response.success) {
                Toast.show({
                    type: 'success',
                    text1: t('consultationRating.feedbackReceived'),
                    text2: t('consultationRating.thankYou'),
                    position: 'top',
                });
                // The score only. The tags and free text are the user's words about
                // a health consultation and stay on the server.
                track(AnalyticsEvent.CONSULTATION_RATED, { rating });
                setDone(true);
                dismissTimer.current = setTimeout(goBack, AUTO_DISMISS_MS);
            }
        } catch (error: any) {
            // 409 means this consultation was already rated — a second tap, or a second
            // trip through the same notification. Show the rating that stuck rather than
            // an error the user can do nothing about.
            if (error?.response?.status === 409) {
                setContext(current => (current ? { ...current, alreadyReviewed: true } : current));
                setDone(true);
                return;
            }
            console.error('Error submitting review:', error);
            recordError(error, 'ConsultationRating.submitReview');
            Toast.show({
                type: 'error',
                text1: t('common.error'),
                text2: t('consultationRating.genericError'),
                position: 'top',
            });
        } finally {
            setSubmitting(false);
        }
    };

    const renderConsultatorCard = () => {
        if (contextLoading) {
            return (
                <View style={[styles.consultatorCard, styles.consultatorCardLoading]}>
                    <ActivityIndicator color={colors.darkPurple} />
                </View>
            );
        }

        if (!consultator) return null;

        return (
            <View style={styles.consultatorCard}>
                {consultator.photograph ? (
                    <Image
                        source={{ uri: consultator.photograph }}
                        style={styles.avatar}
                        resizeMode="cover"
                    />
                ) : (
                    <View style={[styles.avatar, styles.avatarFallback]}>
                        <Text style={[styles.avatarInitials, globalStyles.fontBold]}>
                            {initialsOf(consultator.name)}
                        </Text>
                    </View>
                )}

                <View style={styles.consultatorMeta}>
                    <Text style={[styles.consultatorName, globalStyles.fontBold]} numberOfLines={2}>
                        {consultator.name}
                    </Text>
                    {consultatorRole ? (
                        <View style={styles.roleChip}>
                            <Text style={[styles.roleChipText, globalStyles.fontSemiBold]}>
                                {consultatorRole}
                            </Text>
                        </View>
                    ) : null}
                    {context?.consultedAt ? (
                        <View style={styles.sessionDateRow}>
                            <Lucide name="calendar-check" size={14} color={colors.darkGray} />
                            <Text style={[styles.sessionDateText, globalStyles.fontRegular]}>
                                {t('consultationRating.sessionOn', {
                                    date: formatSessionDate(context.consultedAt),
                                })}
                            </Text>
                        </View>
                    ) : null}
                </View>
            </View>
        );
    };

    if (done) {
        return (
            <SafeAreaView style={styles.screen} edges={['bottom', 'left', 'right']}>
                <View style={styles.doneWrapper}>
                    <View style={styles.doneIconCircle}>
                        <Lucide name="check" size={38} color={colors.white} />
                    </View>
                    <Text style={[styles.doneTitle, globalStyles.fontBold]}>
                        {context?.alreadyReviewed
                            ? t('consultationRating.alreadyReviewed.title')
                            : t('consultationRating.feedbackReceived')}
                    </Text>
                    <Text style={[styles.doneBody, globalStyles.fontRegular]}>
                        {context?.alreadyReviewed
                            ? t('consultationRating.alreadyReviewed.body')
                            : t('consultationRating.thankYou')}
                    </Text>
                    {rating > 0 ? (
                        <Text style={[styles.doneRating, globalStyles.fontSemiBold]}>
                            {t('consultationRating.alreadyReviewed.yourRating', { rating })}
                        </Text>
                    ) : null}
                    <View style={styles.doneButtonWrapper}>
                        <GradientButtonWithSlightRadius
                            title={t('consultationRating.alreadyReviewed.done')}
                            onPress={goBack}
                        />
                    </View>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.screen} edges={['bottom', 'left', 'right']}>
            <KeyboardAvoidingView
                style={styles.flex}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                >
                    {renderConsultatorCard()}

                    <Text style={[styles.heading, globalStyles.fontBold]}>
                        {consultator
                            ? t('consultationRating.headingWithName', { name: consultator.name })
                            : t('consultationRating.headingGeneric')}
                    </Text>
                    <Text style={[styles.subheading, globalStyles.fontRegular]}>
                        {t('consultationRating.privacyNote')}
                    </Text>

                    {contextFailed ? (
                        <TouchableOpacity
                            style={styles.contextErrorRow}
                            activeOpacity={0.8}
                            onPress={loadContext}
                        >
                            <Lucide name="triangle-alert" size={14} color={colors.warning} />
                            <Text style={[styles.contextErrorText, globalStyles.fontRegular]}>
                                {t('consultationRating.loadError')}
                            </Text>
                            <Text style={[styles.contextRetryText, globalStyles.fontSemiBold]}>
                                {t('common.retry')}
                            </Text>
                        </TouchableOpacity>
                    ) : null}

                    <View style={styles.ratingBlock}>
                        <AirbnbRating
                            count={5}
                            defaultRating={rating}
                            showRating={false}
                            size={38}
                            onFinishRating={handleRating}
                            selectedColor={colors.darkPurple}
                            starImage={require('../public/assets/images/star-outline.png')}
                            starContainerStyle={styles.starContainer}
                            isDisabled={submitting}
                        />
                        {rating > 0 ? (
                            <View style={[styles.ratingChip, { backgroundColor: ratingTone.bg }]}>
                                <Text
                                    style={[
                                        styles.ratingChipText,
                                        globalStyles.fontSemiBold,
                                        { color: ratingTone.text },
                                    ]}
                                >
                                    {ratingLabel}
                                </Text>
                            </View>
                        ) : (
                            <Text style={[styles.tapHint, globalStyles.fontRegular]}>
                                {t('consultationRating.tapToRate')}
                            </Text>
                        )}
                    </View>

                    {rating > 0 ? (
                        <View style={styles.tagsBlock}>
                            <Text style={[styles.sectionLabel, globalStyles.fontSemiBold]}>
                                {rating >= POSITIVE_RATING_THRESHOLD
                                    ? t('consultationRating.tags.positiveTitle')
                                    : t('consultationRating.tags.improvementTitle')}
                            </Text>
                            <View style={styles.tagsWrap}>
                                {tagKeys.map(key => {
                                    const active = selectedTags.includes(key);
                                    return (
                                        <TouchableOpacity
                                            key={key}
                                            activeOpacity={0.8}
                                            onPress={() => toggleTag(key)}
                                            disabled={submitting}
                                            accessibilityRole="checkbox"
                                            accessibilityState={{ checked: active }}
                                            style={[styles.tag, active && styles.tagActive]}
                                        >
                                            <Text
                                                style={[
                                                    styles.tagText,
                                                    globalStyles.fontSemiBold,
                                                    active && styles.tagTextActive,
                                                ]}
                                            >
                                                {t(`consultationRating.tags.${key}`)}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        </View>
                    ) : null}

                    <View style={styles.reviewBlock}>
                        <Text style={[styles.sectionLabel, globalStyles.fontSemiBold]}>
                            {t('consultationRating.reviewLabel')}
                        </Text>
                        <TextInput
                            inputMode="text"
                            multiline
                            maxLength={REVIEW_MAX_LENGTH}
                            selectionColor={colors.darkPurple}
                            placeholder={t('consultationRating.reviewPlaceholder')}
                            placeholderTextColor={colors.gray}
                            style={[
                                styles.reviewInput,
                                globalStyles.fontRegular,
                                inputFocused && styles.reviewInputFocused,
                            ]}
                            onFocus={() => setInputFocused(true)}
                            onBlur={() => setInputFocused(false)}
                            onChangeText={setReview}
                            value={review}
                            editable={!submitting}
                        />
                        <Text style={[styles.charCount, globalStyles.fontRegular]}>
                            {review.length}/{REVIEW_MAX_LENGTH}
                        </Text>
                    </View>
                </ScrollView>

                <View style={styles.footer}>
                    {submitting ? (
                        <View style={styles.submittingButton}>
                            <ActivityIndicator color={colors.white} size="small" />
                            <Text style={[styles.submittingText, globalStyles.fontSemiBold]}>
                                {t('consultationRating.submitting')}
                            </Text>
                        </View>
                    ) : (
                        <GradientButtonWithSlightRadius
                            title={t('consultationRating.submitReview')}
                            onPress={submitReview}
                            disabled={rating === 0 || !consultationId}
                        />
                    )}
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    flex: { flex: 1 },
    screen: {
        flex: 1,
        backgroundColor: colors.white,
    },
    scrollContent: {
        paddingHorizontal: 20,
        paddingTop: 16,
        paddingBottom: 24,
    },
    consultatorCard: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        padding: 14,
        borderRadius: 16,
        backgroundColor: colors.lightPurple,
    },
    consultatorCardLoading: {
        justifyContent: 'center',
        minHeight: 96,
    },
    avatar: {
        width: 68,
        height: 68,
        borderRadius: 34,
        backgroundColor: colors.white,
    },
    avatarFallback: {
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.purple,
    },
    avatarInitials: {
        fontSize: 24,
        color: colors.white,
    },
    consultatorMeta: {
        flex: 1,
        gap: 6,
    },
    consultatorName: {
        fontSize: 18,
        color: colors.darkPurple,
    },
    roleChip: {
        alignSelf: 'flex-start',
        paddingHorizontal: 10,
        paddingVertical: 3,
        borderRadius: 12,
        backgroundColor: colors.white,
    },
    roleChipText: {
        fontSize: 12,
        color: colors.purple,
    },
    sessionDateRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    sessionDateText: {
        fontSize: 12,
        color: colors.darkGray,
    },
    heading: {
        fontSize: 22,
        lineHeight: 30,
        color: colors.text,
        marginTop: 24,
    },
    subheading: {
        fontSize: 13,
        color: colors.darkGray,
        marginTop: 6,
    },
    contextErrorRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: 12,
        padding: 10,
        borderRadius: 10,
        backgroundColor: colors.yellowBadgeBG,
    },
    contextErrorText: {
        flex: 1,
        fontSize: 12,
        color: colors.text,
    },
    contextRetryText: {
        fontSize: 12,
        color: colors.darkPurple,
    },
    ratingBlock: {
        alignItems: 'center',
        marginTop: 26,
    },
    starContainer: {
        marginBottom: 4,
    },
    ratingChip: {
        marginTop: 10,
        paddingHorizontal: 16,
        paddingVertical: 6,
        borderRadius: 16,
    },
    ratingChipText: {
        fontSize: 14,
    },
    tapHint: {
        marginTop: 12,
        fontSize: 13,
        color: colors.gray,
    },
    sectionLabel: {
        fontSize: 14,
        color: colors.text,
        marginBottom: 10,
    },
    tagsBlock: {
        marginTop: 26,
    },
    tagsWrap: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    tag: {
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.white,
    },
    tagActive: {
        borderColor: colors.darkPurple,
        backgroundColor: colors.lightPurple,
    },
    tagText: {
        fontSize: 13,
        color: colors.darkGray,
    },
    tagTextActive: {
        color: colors.darkPurple,
    },
    reviewBlock: {
        marginTop: 26,
    },
    reviewInput: {
        minHeight: 130,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.lightGray,
        padding: 14,
        fontSize: 15,
        color: colors.text,
        textAlignVertical: 'top',
    },
    reviewInputFocused: {
        borderColor: colors.darkPurple,
        backgroundColor: colors.white,
    },
    charCount: {
        alignSelf: 'flex-end',
        marginTop: 6,
        fontSize: 11,
        color: colors.gray,
    },
    footer: {
        flexDirection: 'row',
        paddingHorizontal: 20,
        paddingTop: 8,
        paddingBottom: 12,
        borderTopWidth: 1,
        borderTopColor: colors.border,
        backgroundColor: colors.white,
    },
    submittingButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        marginTop: 10,
        paddingVertical: 16,
        borderRadius: 10,
        backgroundColor: colors.darkPurple,
        opacity: 0.8,
    },
    submittingText: {
        fontSize: 16,
        color: colors.white,
    },
    doneWrapper: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 32,
    },
    doneIconCircle: {
        width: 76,
        height: 76,
        borderRadius: 38,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.darkPurple,
    },
    doneTitle: {
        marginTop: 20,
        fontSize: 20,
        textAlign: 'center',
        color: colors.darkPurple,
    },
    doneBody: {
        marginTop: 10,
        fontSize: 14,
        lineHeight: 21,
        textAlign: 'center',
        color: colors.darkGray,
    },
    doneRating: {
        marginTop: 14,
        fontSize: 14,
        color: colors.purple,
    },
    doneButtonWrapper: {
        flexDirection: 'row',
        alignSelf: 'stretch',
        marginTop: 28,
    },
});

export default ConsultationRating;
