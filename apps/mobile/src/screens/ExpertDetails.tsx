import Lucide from "@react-native-vector-icons/lucide";
import { useRoute } from "@react-navigation/native";
import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
    ActivityIndicator,
    Dimensions,
    Image,
    ScrollView,
    StyleSheet,
    Text,
    View
} from "react-native";
import LinearGradient from "react-native-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { getExpertById } from "../api/getExpertsById";
import { useLanguage } from "../context/LanguageContext";
import GradientButtonWithSlightRadius from "../components/GradientButtonWithSlightRadius";
import { colors } from "../public/assets/colors";
import { globalStyles } from "../public/styles";
import { IExpert, IExpertByIdResponse, IExpertLoadingState } from "../types/expert.types";
import apiClientInterceptor from "../api/apiClientInterceptor";
import { RAZORPAY_BOOK_CONSULTATION_CREATE_ORDER, RAZORPAY_BOOK_CONSULTATION_VERIFY_ORDER } from "../constants/endpoints";
import { IPaymentOrderResponse } from "../types/subscription.types";
import { RAZORPAY_API_KEY } from "@env";
import RazorpayCheckout from "react-native-razorpay";
import Toast from "react-native-toast-message";
import { useSubscriptionContext } from "../context/SubscriptionContext";
import { BOOK_CONSULTATION_WITH_CREDIT } from "../constants/endpoints";
import { PreferredSlot } from "../constants/consultationSlots";
import ConsultationBookingSheet from "../components/consultation/ConsultationBookingSheet";
import { isInPersonOnlyExpert } from "../utils/expertRules";
import BookingConfirmedModal from "../components/consultation/BookingConfirmedModal";
import { AnalyticsEvent, recordError, track } from "../analytics";

const { height } = Dimensions.get("window");

const ExpertDetails = () => {
    const { t } = useTranslation();
    const { language } = useLanguage();
    const route = useRoute<any>();
    const { expertId } = route.params;
    // Credit balances come from the server snapshot; the button below chooses the
    // booking path from them rather than from the tier, so a premium user who has run
    // out of credits still gets the pay-per-session flow.
    const { entitlements, refresh } = useSubscriptionContext();
    const expertCredits = entitlements?.credits?.expert ?? 0;

    const [expert, setExpert] = useState<IExpert | undefined>();
    const [loading, setLoading] = useState<IExpertLoadingState>({
        uiLoading: false,
        paymentLoading: false
    });

    /**
     * Holding credits is no longer enough — they can only be spent on the empanelled
     * panel. An off-panel expert sets their own fee, which a credit does not cover, so
     * this screen must offer the payment route instead of the credit one.
     *
     * Compared against `true` explicitly: an absent flag means an older server, and
     * failing closed here is better than offering a credit the server would refuse.
     */
    const creditsApply = expert?.is_empanelled_expert === true;
    const hasExpertCredit = expertCredits > 0 && creditsApply;

    /**
     * The user's own referring doctor, when she consults at her own clinic rather than
     * through the app. Neither booking route exists for her: there is no fee for
     * Razorpay to charge and a credit would buy a session the app never arranges, so the
     * server refuses both. The screen says so up front instead of letting the patient
     * reach a payment sheet that cannot open.
     *
     * Only ever true for the patient this doctor referred — the directory endpoint does
     * not serve her to anyone else.
     */
    const inPersonOnly = expert !== undefined && isInPersonOnlyExpert(expert);
    const [showBookingSheet, setShowBookingSheet] = useState(false);
    const [showConfirmation, setShowConfirmation] = useState(false);

    /** Both booking routes land here, so the patient sees one confirmation either way. */
    const onBookingSucceeded = () => {
        setShowConfirmation(true);
    };

    /**
     * Credits first; fall back to paying per session once they run out, which is also the
     * only path FREE and TRIAL ever see.
     */
    const handleBookingConfirmed = async (date: Date, slot: PreferredSlot) => {
        setShowBookingSheet(false);
        track(AnalyticsEvent.CONSULTATION_BOOKING_STARTED, {
            consultation_type: 'expert',
            payment_mode: hasExpertCredit ? 'credit' : 'payment',
        });
        if (hasExpertCredit) {
            await bookWithCredit(date, slot);
        } else {
            await bookConsultation(date, slot);
        }
    };

    /**
     * Book using a subscription credit, skipping the payment sheet entirely.
     * Only offered when the balance is above zero — FREE and TRIAL have no bucket and
     * keep the pay-per-session flow untouched.
     */
    const bookWithCredit = async (date: Date, slot: PreferredSlot) => {
        try {
            setLoading({ ...loading, paymentLoading: true });

            await apiClientInterceptor().post(BOOK_CONSULTATION_WITH_CREDIT, {
                expertId,
                preferred_consultation_date: date.toISOString(),
                preferred_slot: slot,
            });

            // Balances changed, so the "1 credit left" label must not go stale.
            await refresh();

            track(AnalyticsEvent.CONSULTATION_BOOKED, {
                consultation_type: 'expert',
                payment_mode: 'credit',
            });
            onBookingSucceeded();
        } catch (error) {
            // A 402 has already opened the paywall centrally; anything else is a fault.
            const status = (error as any)?.response?.status;
            if (status !== 402) {
                Toast.show({
                    type: 'error',
                    text1: t('common.error'),
                    position: 'bottom',
                });
            }
            track(AnalyticsEvent.CONSULTATION_BOOKING_FAILED, {
                consultation_type: 'expert',
                reason: String(status ?? 'network'),
            });
        } finally {
            setLoading({ ...loading, paymentLoading: false });
        }
    };

    const bookConsultation = async (date: Date, slot: PreferredSlot) => {
        try {
            setLoading({
                ...loading,
                paymentLoading: true
            });
            const { data } = await apiClientInterceptor().post(RAZORPAY_BOOK_CONSULTATION_CREATE_ORDER, {
                amount: expert?.remuneration,
                expertId,
                date: date.toISOString(),
                preferredSlot: slot
            }) as { data: IPaymentOrderResponse };

            const options: any = {
                description: `Expert Consultation with ${expert?.name}`,
                image: require("../public/assets/images/viva_logo.png"),
                currency: data.data.currency,
                key: RAZORPAY_API_KEY,
                amount: data.data.amount,
                order_id: data.data.order_id,
                name: `Expert Consultation with ${expert?.name}`,
                prefill: {
                },
                theme: { color: colors.darkPurple }
            }
            RazorpayCheckout.open(options).then(async (razorpay_data) => {
                try {
                    await apiClientInterceptor().post(RAZORPAY_BOOK_CONSULTATION_VERIFY_ORDER, {
                        razorpay_order_id: razorpay_data.razorpay_order_id,
                        razorpay_payment_id: razorpay_data.razorpay_payment_id,
                        razorpay_signature: razorpay_data.razorpay_signature
                    });

                    track(AnalyticsEvent.CONSULTATION_BOOKED, {
                        consultation_type: 'expert',
                        payment_mode: 'payment',
                    });
                    onBookingSucceeded();

                } catch (verifyError) {
                    Toast.show({
                        type: 'error',
                        text1: t('subscription.verificationFailedTitle'),
                        text2: t('subscription.verificationFailedToast'),
                        position: 'bottom'
                    });
                    track(AnalyticsEvent.CONSULTATION_BOOKING_FAILED, {
                        consultation_type: 'expert',
                        reason: 'verify_failed',
                    });
                    // The user has paid but has no consultation. Unlike the
                    // subscription flow there is no reconcile path here, so this
                    // needs to be loud.
                    recordError(verifyError, 'ExpertDetails.verifyConsultationOrder', {
                        expert_id: expertId,
                    });
                }
            }).catch((error) => {
                setLoading({
                    ...loading,
                    paymentLoading: false
                });
                Toast.show({
                    type: 'error',
                    text1: t('common.error'),
                    text2: `${t('common.error')}: ${error.code} | ${error.description}`,
                    position: 'bottom'
                });
                console.error(`Error: ${error.code} | ${error.description}`);
                // Razorpay reports a deliberate dismissal through this same path,
                // so it is an outcome, not an error worth recording.
                track(AnalyticsEvent.CONSULTATION_BOOKING_FAILED, {
                    consultation_type: 'expert',
                    reason:
                        error?.code === 0 || error?.code === 2
                            ? 'razorpay_cancelled'
                            : String(error?.code ?? 'unknown'),
                });
            }).finally(() => {
                setLoading({
                    ...loading,
                    paymentLoading: false
                });
            })
        } catch (error: any) {
            setLoading({
                ...loading,
                paymentLoading: false
            });
            console.error('Payment Error:', error);
            Toast.show({
                type: 'error',
                text1: t('common.error'),
                text2: t('subscription.somethingWrong'),
                position: 'bottom'
            });
            track(AnalyticsEvent.CONSULTATION_BOOKING_FAILED, {
                consultation_type: 'expert',
                reason: String(error?.response?.status ?? 'order_create_failed'),
            });
        }
    }

    useEffect(() => {
        (async () => {
            try {
                setLoading((prev) => ({
                    ...prev,
                    uiLoading: true
                }));
                const response: IExpertByIdResponse = await getExpertById(expertId);
                setExpert(response.data);
                track(AnalyticsEvent.EXPERT_PROFILE_VIEWED, { expert_id: expertId });
            } catch (error) {
                console.error("Error fetching expert:", error);
                recordError(error, 'ExpertDetails.getExpertById', {
                    expert_id: expertId,
                });
            } finally {
                setLoading((prev) => ({
                    ...prev,
                    uiLoading: false
                }));
            }
        })();
    }, [expertId, language]);

    if (loading.uiLoading) {
        return (
            <SafeAreaView style={[globalStyles.container, styles.centerContainer]} edges={['bottom', 'left', 'right']}>
                <ActivityIndicator size="large" color={colors.darkPurple || colors.purple} />
                <Text style={[styles.loadingText, globalStyles.fontRegular]}>
                    {t('expertDetails.loadingDetails')}
                </Text>
            </SafeAreaView>
        );
    }

    if (!expert) {
        return (
            <SafeAreaView style={[globalStyles.container, styles.centerContainer]} edges={['bottom', 'left', 'right']}>
                <Lucide name="user-x" size={64} color="#ccc" />
                <Text style={[styles.notFoundText, globalStyles.fontSemiBold]}>
                    {t('expertDetails.notFound')}
                </Text>
                <Text style={[styles.notFoundSubtext, globalStyles.fontRegular]}>
                    {t('expertDetails.notFoundSub')}
                </Text>
            </SafeAreaView>
        );
    }

    return (
        // Stack screen with `headerShown: true` — the header already consumes the top
        // inset, so claiming it again double-pads. The bottom is ours.
        <SafeAreaView style={[styles.safeArea]} edges={['bottom', 'left', 'right']}>
            <ScrollView
                style={[styles.scrollView, globalStyles.container]}
                showsVerticalScrollIndicator={false}
            >
                {/* Hero Section with Photo */}
                <View style={styles.heroContainer}>
                    <Image
                        source={{ uri: expert.photograph }}
                        style={styles.heroImage}
                        resizeMode="cover"
                    />
                    <LinearGradient
                        colors={['transparent', 'rgba(0,0,0,0.7)']}
                        style={styles.imageOverlay}
                    >
                        <View style={styles.heroContent}>
                            <Text style={[styles.heroName, globalStyles.fontBold]}>
                                {expert.name}
                            </Text>
                            <View style={styles.specialityBadge}>
                                <Text style={[styles.heroSpeciality, globalStyles.fontSemiBold]}>
                                    {expert.speciality}
                                </Text>
                            </View>
                        </View>
                    </LinearGradient>
                </View>

                {/* Content Section */}
                <View style={styles.contentContainer}>
                    {/* Experience Highlight */}
                    <View style={styles.experienceCard}>
                        <LinearGradient
                            colors={[colors.darkPurple, colors.purple]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={styles.experienceGradient}
                        >
                            <Lucide name="badge-check" size={32} color="#fff" />
                            <View style={styles.experienceTextContainer}>
                                <Text style={[styles.experienceNumber, globalStyles.fontBold]}>
                                    {t('experts.yearsExperience', { years: expert.yearsOfExperience })}
                                </Text>
                                <Text style={[styles.experienceLabel, globalStyles.fontRegular]}>
                                    {t('expertDetails.ofExperience')}
                                </Text>
                            </View>
                        </LinearGradient>
                    </View>

                    {/* Qualification Card */}
                    {
                        expert.qualification && (

                            <View style={styles.infoCard}>
                                <View style={styles.cardHeader}>
                                    <Lucide name="school" size={20} color={colors.purple} />
                                    <Text style={[styles.cardTitle, globalStyles.fontBold]}>
                                        {t('expertDetails.qualification')}
                                    </Text>
                                </View>
                                <Text style={[styles.cardContent, globalStyles.fontRegular]}>
                                    {expert.qualification}
                                </Text>
                            </View>
                        )
                    }

                    {/* About / Bio Card */}
                    {
                        expert.bio && (

                            <View style={styles.infoCard}>
                                <View style={styles.cardHeader}>
                                    <Lucide name="info" size={20} color={colors.purple} />
                                    <Text style={[styles.cardTitle, globalStyles.fontBold]}>
                                        {t('expertDetails.about')}
                                    </Text>
                                </View>
                                <Text style={[styles.bioText, globalStyles.fontRegular]}>
                                    {expert.bio}
                                </Text>
                            </View>
                        )
                    }

                    {/* Speciality Details Card */}
                    <View style={styles.infoCard}>
                        <View style={styles.cardHeader}>
                            <Lucide name="briefcase-medical" size={20} color={colors.purple} />
                            <Text style={[styles.cardTitle, globalStyles.fontBold]}>
                                {t('expertDetails.speciality')}
                            </Text>
                        </View>
                        <Text style={[styles.cardContent, globalStyles.fontRegular]}>
                            {expert.speciality}
                        </Text>
                    </View>

                    {/* Covered Areas Card */}
                    {
                        expert.category?.coveredAreas && expert.category.coveredAreas.length > 0 && (
                            <View style={styles.infoCard}>
                                <View style={styles.cardHeader}>
                                    <Lucide name="list-checks" size={20} color={colors.purple} />
                                    <Text style={[styles.cardTitle, globalStyles.fontBold]}>
                                        {t('expertDetails.coveredAreas')}
                                    </Text>
                                </View>
                                <View style={styles.badgeContainer}>
                                    {expert.category.coveredAreas.map((area, index) => (
                                        <View key={index} style={styles.areaBadge}>
                                            <Text style={[styles.areaBadgeText, globalStyles.fontRegular]}>
                                                {area}
                                            </Text>
                                        </View>
                                    ))}
                                </View>
                            </View>
                        )
                    }

                    {/* Fee, or — for the patient's own clinic doctor — the reason there
                        is none. A ₹0 remuneration row would read as a bug; what it
                        actually means is that this consultation happens in person. */}
                    {inPersonOnly ? (
                        <View style={[styles.infoCard, styles.inPersonCard]}>
                            <View style={styles.cardHeader}>
                                <Lucide name="hospital" size={20} color={colors.greenBadgeText} />
                                <Text style={[styles.cardTitle, globalStyles.fontBold]}>
                                    {t('expertDetails.inPersonOnlyTitle')}
                                </Text>
                            </View>
                            <Text style={[styles.inPersonBody, globalStyles.fontSemiBold]}>
                                {t('expertDetails.inPersonOnlyBody')}
                            </Text>
                            <Text style={[styles.inPersonNote, globalStyles.fontRegular]}>
                                {t('expertDetails.inPersonOnlyNote')}
                            </Text>
                        </View>
                    ) : (
                        <View style={styles.infoCard}>
                            <View style={styles.cardHeader}>
                                <Lucide name="wallet" size={20} color={colors.purple} />
                                <Text style={[styles.cardTitle, globalStyles.fontBold]}>
                                    {t('expertDetails.remuneration')}
                                </Text>
                            </View>
                            <Text style={[styles.cardContent, globalStyles.fontRegular]}>
                                {t('expertDetails.fee', { amount: expert.remuneration })}
                            </Text>
                            {/* Whether credits apply is the single most consequential thing
                                about the fee, so it sits with it rather than surfacing for
                                the first time inside the booking sheet. */}
                            <Text
                                style={[
                                    styles.feeNote,
                                    globalStyles.fontRegular,
                                    creditsApply && styles.feeNoteCovered,
                                ]}
                            >
                                {creditsApply
                                    ? t('expertDetails.creditsApply')
                                    : t('expertDetails.creditsDoNotApply')}
                            </Text>
                        </View>
                    )}
                </View>
            </ScrollView>

            {/* One button; date, slot and cost all live in the sheet it opens, so the
                profile itself stays readable rather than half-covered by a form.

                For an in-person-only doctor the button is replaced rather than greyed
                out: a disabled "Book Consultation" reads as a fault the patient should
                retry, while this says what to do instead. */}
            <View style={styles.actionArea}>
                {inPersonOnly ? (
                    <View style={styles.inPersonAction}>
                        <Lucide name="hospital" size={22} color={colors.greenBadgeText} />
                        <View style={styles.inPersonActionText}>
                            <Text style={[styles.inPersonActionTitle, globalStyles.fontBold]}>
                                {t('expertDetails.inPersonOnlyBody')}
                            </Text>
                            <Text style={[styles.inPersonActionSub, globalStyles.fontRegular]}>
                                {t('expertDetails.inPersonOnlyAction')}
                            </Text>
                        </View>
                    </View>
                ) : (
                    <GradientButtonWithSlightRadius
                        onPress={() => setShowBookingSheet(true)}
                        fullRounded
                        disabled={loading.paymentLoading}
                        title={
                            loading.paymentLoading
                                ? t('expertDetails.processing')
                                : t('expertDetails.bookConsultation')
                        }
                    />
                )}
            </View>

            <ConsultationBookingSheet
                visible={showBookingSheet}
                onClose={() => setShowBookingSheet(false)}
                onConfirm={handleBookingConfirmed}
                title={t('expertDetails.bookWith', { name: expert.name })}
                credits={expertCredits}
                feeAmount={expert.remuneration}
                creditsApply={creditsApply}
                // Names the actual outcome of the tap — spend a credit, or pay the fee.
                confirmLabel={
                    hasExpertCredit
                        ? t('expertDetails.bookWithCredit', { count: expertCredits })
                        : t('expertDetails.payAndBook', { amount: expert.remuneration })
                }
                submitting={loading.paymentLoading}
            />

            <BookingConfirmedModal
                visible={showConfirmation}
                onDismiss={() => setShowConfirmation(false)}
            />
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: '#f8f9fa',
    },
    scrollView: {
        flex: 1,
        backgroundColor: '#f8f9fa'
    },
    centerContainer: {
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    loadingText: {
        marginTop: 16,
        fontSize: 16,
        color: '#666',
    },
    notFoundText: {
        marginTop: 16,
        fontSize: 20,
        color: '#333',
    },
    notFoundSubtext: {
        marginTop: 8,
        fontSize: 16,
        color: '#666',
        textAlign: 'center',
    },
    heroContainer: {
        position: 'relative',
        width: '100%',
        height: height * 0.45,
        // padding: 20,
    },
    heroImage: {
        width: '100%',
        height: '100%',
        backgroundColor: '#f0f0f0',
    },
    imageOverlay: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: '60%',
        justifyContent: 'flex-end',
    },
    heroContent: {
        padding: 20,
        paddingBottom: 30,
    },
    heroName: {
        fontSize: 24,
        color: '#fff',
        marginBottom: 10,
        textShadowColor: 'rgba(0, 0, 0, 0.3)',
        textShadowOffset: { width: 0, height: 2 },
        textShadowRadius: 4,
    },
    specialityBadge: {
        alignSelf: 'flex-start',
        backgroundColor: 'rgba(255, 255, 255, 0.25)',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.4)',
    },
    heroSpeciality: {
        fontSize: 14,
        color: '#fff',
        fontWeight: '600',
    },
    contentContainer: {
        paddingVertical: 20,
    },
    experienceCard: {
        marginBottom: 20,
        borderRadius: 16,
        overflow: 'hidden',
        elevation: 4,
        shadowColor: colors.purple,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
    },
    experienceGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 20,
        gap: 16,
    },
    experienceTextContainer: {
        flex: 1,
    },
    experienceNumber: {
        fontSize: 20,
        color: '#fff',
        marginBottom: 4,
    },
    experienceLabel: {
        fontSize: 16,
        color: 'rgba(255, 255, 255, 0.9)',
    },
    infoCard: {
        backgroundColor: colors.white,
        borderRadius: 8,
        padding: 18,
        marginBottom: 16,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
        gap: 10,
    },
    cardTitle: {
        fontSize: 16,
        color: '#1a1a1a',
    },
    cardContent: {
        fontSize: 16,
        color: '#555',
    },
    feeNote: {
        fontSize: 12,
        lineHeight: 17,
        color: colors.darkGray,
        marginTop: 6,
    },
    feeNoteCovered: {
        color: colors.greenBadgeText,
    },
    // Green and left-ruled, so it reads as "this is how your care works" rather than as
    // the grey unavailable-fee state it replaces.
    inPersonCard: {
        backgroundColor: colors.greenBadgeBG,
        borderLeftWidth: 4,
        borderLeftColor: colors.greenBadgeText,
    },
    inPersonBody: {
        fontSize: 16,
        lineHeight: 22,
        color: '#1a1a1a',
    },
    inPersonNote: {
        fontSize: 12,
        lineHeight: 18,
        color: colors.darkGray,
        marginTop: 8,
    },
    bioText: {
        fontSize: 16,
        color: '#555',
        lineHeight: 20,
    },
    badgeContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginTop: 4,
    },
    areaBadge: {
        backgroundColor: colors.lightPurple,
        borderWidth: 1,
        borderColor: colors.purple,
        borderRadius: 20,
        paddingHorizontal: 12,
        paddingVertical: 6,
    },
    areaBadgeText: {
        fontSize: 13,
        color: colors.purple,
        lineHeight: 18,
    },
    bottomPadding: {
        height: 100,
    },

    actionArea: {
        flexDirection: 'row',
        paddingHorizontal: 20,
        paddingTop: 12,
        paddingBottom: 16,
        backgroundColor: colors.white,
        borderTopWidth: 1,
        borderTopColor: colors.border,
    },
    // Sits where the button would, and takes the same width, so the bar keeps its shape
    // — but it is a View, not a Touchable: there is nothing here to tap.
    inPersonAction: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 30,
        backgroundColor: colors.greenBadgeBG,
    },
    inPersonActionText: {
        flex: 1,
    },
    inPersonActionTitle: {
        fontSize: 14,
        lineHeight: 19,
        color: '#1a1a1a',
    },
    inPersonActionSub: {
        fontSize: 11,
        color: colors.darkGray,
        marginTop: 2,
    },
});

export default ExpertDetails;
