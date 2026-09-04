import Lucide from '@react-native-vector-icons/lucide'
import React, { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FlatList, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { getExperts } from '../api/getExperts'
import { getUserData } from '../api/userData.api'
import { useLanguage } from '../context/LanguageContext'
import { globalStyles } from '../public/styles'
import { colors } from '../public/assets/colors'
import { IExpert, IExpertResponse } from '../types/expert.types'
import { IUserDataResponse } from '../types/dashboard.types'
import ExpertItem from '../components/experts/FLExpertItem'
import { isInPersonOnlyExpert } from '../utils/expertRules'
import { AnalyticsEvent, recordError, track } from '../analytics'

// ─── Own Doctor Card ────────────────────────────────────────────────────────

/**
 * Full-width card for the user's referred ("own") doctor.
 * Matches the screenshot design: photo + purple badge + name + speciality +
 * experience pill + CTA text.
 *
 * A doctor who consults in person only gets a different closing line: promising a
 * booking she does not take would send the patient to a screen whose only button is
 * disabled. See isInPersonOnlyExpert.
 */
const OwnDoctorCard = ({
    expert,
    navigation,
}: {
    expert: IExpert;
    navigation: { navigate: any };
}) => {
    const { t } = useTranslation();
    const inPersonOnly = isInPersonOnlyExpert(expert);

    return (
        <TouchableOpacity
            activeOpacity={0.85}
            style={styles.ownDoctorCard}
            onPress={() => navigation.navigate('ExpertDetails', { expertId: expert._id })}
        >
            <View style={styles.ownDoctorImageContainer}>
                <Image
                    source={{ uri: expert.photograph }}
                    resizeMode="cover"
                    style={styles.ownDoctorImage}
                />
            </View>

            <View style={styles.ownDoctorInfo}>
                {/* Badge */}
                <View style={styles.ownDoctorBadge}>
                    <Text style={[globalStyles.fontBold, styles.ownDoctorBadgeText]}>
                        {t('experts.sections.nonEmpanelled')}
                    </Text>
                </View>

                {/* Name */}
                <Text style={[globalStyles.fontBold, styles.ownDoctorName]}>
                    {expert.name}
                </Text>

                {/* Speciality */}
                <Text style={[globalStyles.fontRegular, styles.ownDoctorSpeciality]}>
                    {expert.speciality}
                </Text>

                {/* Experience + mode pills */}
                <View style={styles.ownDoctorPillRow}>
                    <View style={styles.ownDoctorExpPill}>
                        <Text style={[globalStyles.fontBold, styles.ownDoctorExpText]}>
                            {t('experts.yearsExperience', { years: expert.yearsOfExperience })}
                        </Text>
                    </View>

                    {inPersonOnly ? (
                        <View style={styles.ownDoctorModePill}>
                            <Lucide name="hospital" size={11} color={colors.greenBadgeText} />
                            <Text style={[globalStyles.fontBold, styles.ownDoctorModeText]}>
                                {t('experts.inPersonOnlyBadge')}
                            </Text>
                        </View>
                    ) : null}
                </View>

                {/* CTA */}
                <Text style={[globalStyles.fontBold, styles.ownDoctorCta]}>
                    {inPersonOnly ? t('experts.meetInPerson') : t('experts.bookDirectly')}
                </Text>
                <Text style={[globalStyles.fontRegular, styles.ownDoctorCtaSub]}>
                    {inPersonOnly ? t('experts.meetInPersonSub') : t('experts.clinicFee')}
                </Text>
            </View>
        </TouchableOpacity>
    );
};

// ─── Own Doctor Section ──────────────────────────────────────────────────────

const OwnDoctorSection = ({
    expert,
    navigation,
}: {
    expert: IExpert | null;
    navigation: { navigate: any };
}) => {
    const { t } = useTranslation();
    if (!expert) return null;

    return (
        <View style={styles.section}>
            <Text style={[globalStyles.fontBold, styles.sectionTitle]}>
                {t('experts.sections.nonEmpanelled')}
            </Text>
            <Text style={[globalStyles.fontRegular, styles.sectionCaption]}>
                {t('experts.sections.nonEmpanelledCaption')}
            </Text>
            <OwnDoctorCard expert={expert} navigation={navigation} />
        </View>
    );
};

// ─── Generic Section (2-column grid) ────────────────────────────────────────

/**
 * A two-column grid of experts under a heading.
 *
 * Not scrollable: both grids live inside one page-level ScrollView, so scrolling
 * here would fight the parent. The directory is a curated panel rather than a
 * growing feed, so rendering it whole costs little.
 */
const ExpertSection = ({
    title,
    caption,
    experts,
    navigation,
}: {
    title: string;
    caption: string;
    experts: IExpert[];
    navigation: { navigate: any };
}) => {
    // A section with nobody in it is not an empty state worth explaining.
    if (experts.length === 0) {
        return null;
    }

    return (
        <View style={styles.section}>
            <Text style={[globalStyles.fontBold, styles.sectionTitle]}>{title}</Text>
            <Text style={[globalStyles.fontRegular, styles.sectionCaption]}>{caption}</Text>

            <FlatList
                keyExtractor={(item: IExpert) => item._id}
                data={experts}
                renderItem={({ item }) => <ExpertItem item={item} navigation={navigation} />}
                columnWrapperStyle={styles.column}
                numColumns={2}
                scrollEnabled={false}
                nestedScrollEnabled={false}
            />
        </View>
    );
};

// ─── Main Screen ─────────────────────────────────────────────────────────────

const Experts = ({ navigation }: { navigation: { navigate: any } }) => {
    const { t } = useTranslation();
    const { language } = useLanguage();
    const [experts, setExperts] = useState<IExpert[]>([]);
    const [referredByExpertId, setReferredByExpertId] = useState<string | null>(null);

    useEffect(() => {
        (async () => {
            try {
                const [expertsRes, userRes] = await Promise.all([
                    getExperts() as Promise<IExpertResponse>,
                    getUserData() as Promise<IUserDataResponse>,
                ]);
                setExperts(expertsRes.data);
                setReferredByExpertId(
                    (userRes.data.user as any).referred_by_expert_id ?? null
                );
                track(AnalyticsEvent.EXPERT_LIST_VIEWED);
            } catch (error) {
                // Previously uncaught: a failure here rejected into nothing and
                // left the screen permanently empty with no error and no retry.
                recordError(error, 'Experts.loadExperts');
            }
        })();
    }, [language]);

    /**
     * Derive the three logical groups:
     *
     *  1. ownDoctor     — the expert who referred this user (null if none).
     *  2. empanelled    — plan-credit doctors (the "care team").
     *  3. specialists   — non-empanelled doctors, excluding the own doctor.
     *
     * The own-doctor exclusion prevents the referred expert appearing twice — once
     * at the top in the full-width card and again in the specialists grid.
     *
     * In-person-only doctors are excluded from both grids as well. The server only ever
     * serves one to the patient she referred, so in practice she is already the own
     * doctor — but a card in a "book at their clinic fee" grid would advertise a booking
     * that the details screen then refuses, and that is worth failing closed on.
     */
    const { ownDoctor, empanelled, specialists } = useMemo(() => {
        const own = referredByExpertId
            ? experts.find((e) => String(e._id) === String(referredByExpertId)) ?? null
            : null;

        const bookable = experts.filter((e) => !isInPersonOnlyExpert(e));

        return {
            ownDoctor: own,
            empanelled: bookable.filter((e) => e.is_empanelled_expert === true),
            specialists: bookable.filter(
                (e) =>
                    e.is_empanelled_expert !== true &&
                    String(e._id) !== String(referredByExpertId ?? '')
            ),
        };
    }, [experts, referredByExpertId]);

    return (
        // Tab screen: the tab header consumes the top inset and the tab bar consumes
        // the bottom one (DashboardTabs `tabBarStyle`), so applying either here would
        // just add dead space.
        <SafeAreaView style={[globalStyles.container]} edges={['left', 'right']}>
            <ScrollView showsVerticalScrollIndicator={false}>

                <View style={styles.pageHeading}>
                    <Text style={[globalStyles.fontBold, styles.heading]}>
                        {t('dashboard.connectHealthcare')}
                    </Text>
                    <Text style={[globalStyles.fontRegular, styles.disclaimer]}>
                        {t('dashboard.consultationDisclaimer')}
                    </Text>
                </View>

                {/* 1. Own doctor — shown only when the user has an expert referral */}
                <OwnDoctorSection expert={ownDoctor} navigation={navigation} />

                {/* 2. Care team — empanelled, bookable with plan credits */}
                <ExpertSection
                    title={t('experts.sections.empanelled')}
                    caption={t('experts.sections.empanelledCaption')}
                    experts={empanelled}
                    navigation={navigation}
                />

                {/* 3. Specialists — non-empanelled, pay-per-session, own doctor excluded */}
                <ExpertSection
                    title={t('experts.sections.consultSpecialist')}
                    caption={t('experts.sections.consultSpecialistCaption')}
                    experts={specialists}
                    navigation={navigation}
                />
            </ScrollView>
        </SafeAreaView>
    );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    pageHeading: {
        marginBottom: 10,
    },
    heading: {
        fontSize: 20,
        fontWeight: '600',
    },
    disclaimer: {
        fontSize: 10,
        color: colors.gray,
        marginTop: 5,
    },
    disclaimerCentred: {
        marginBottom: 15,
        textAlign: 'center',
    },
    section: {
        marginTop: 20,
    },
    sectionTitle: {
        fontSize: 16,
        color: colors.text,
    },
    sectionCaption: {
        fontSize: 11,
        lineHeight: 16,
        color: colors.gray,
        marginTop: 3,
        marginBottom: 12,
    },
    column: {
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        gap: 10,
        marginBottom: 10,
    },

    // Own Doctor Card
    ownDoctorCard: {
        flexDirection: 'row',
        backgroundColor: colors.SubscriptionOptionsBG,
        borderRadius: 12,
        borderWidth: 1.5,
        borderColor: colors.purple,
        padding: 12,
    },
    ownDoctorImageContainer: {
        width: 85,
        height: 115,
        borderRadius: 8,
        backgroundColor: colors.lightGray,
        overflow: 'hidden',
        marginRight: 12,
    },
    ownDoctorImage: {
        width: '100%',
        height: '100%',
    },
    ownDoctorInfo: {
        flex: 1,
        justifyContent: 'center',
    },
    ownDoctorBadge: {
        backgroundColor: colors.purple,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 16,
        alignSelf: 'flex-start',
        marginBottom: 6,
    },
    ownDoctorBadgeText: {
        color: colors.white,
        fontSize: 10,
    },
    ownDoctorName: {
        fontSize: 16,
        color: colors.darkPurple,
        marginBottom: 2,
    },
    ownDoctorSpeciality: {
        fontSize: 13,
        color: colors.darkGray,
        marginBottom: 6,
    },
    // Wraps: on a narrow screen the two pills stack rather than squeezing the text.
    ownDoctorPillRow: {
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 6,
        marginBottom: 8,
    },
    ownDoctorExpPill: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: colors.purple,
        backgroundColor: colors.white,
        alignSelf: 'flex-start',
    },
    ownDoctorExpText: {
        color: colors.purple,
        fontSize: 11,
    },
    // Green, matching the "your plan covers this" badge on the grid cards: both mean
    // "nothing to pay here", which is the one thing to read off the card at a glance.
    ownDoctorModePill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 20,
        backgroundColor: colors.greenBadgeBG,
        alignSelf: 'flex-start',
        flexShrink: 1,
    },
    ownDoctorModeText: {
        color: colors.greenBadgeText,
        fontSize: 11,
    },
    ownDoctorCta: {
        fontSize: 12,
        color: colors.purple,
        marginBottom: 1,
    },
    ownDoctorCtaSub: {
        fontSize: 11,
        color: colors.darkGray,
    },
});

export default Experts
