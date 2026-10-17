import messaging, { FirebaseMessagingTypes } from '@react-native-firebase/messaging';
import Lucide from '@react-native-vector-icons/lucide';
import MaterialDesignIcons from "@react-native-vector-icons/material-design-icons";
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, Text, TouchableOpacity, View } from 'react-native';
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withSequence,
    withTiming,
} from 'react-native-reanimated';
import { getExperts } from '../../api/getExperts';
import { getRecentCheckinData } from '../../api/recentCheckIn.api';
import { useLanguage } from '../../context/LanguageContext';
import { useCapability, useSubscriptionContext } from '../../context/SubscriptionContext';
import { Capability, DenialCode, SubscriptionTier } from '../../types/entitlements.types';
import { FLOW_SLUGS } from '../../constants/chat';
import { FlowType } from '../../types/chat.types';
import { colors } from '../../public/assets/colors';
import { globalStyles } from '../../public/styles';
import { IUserActiveConsultations } from '../../types/consultation.types';
import { ICheckInRecommendation, ICheckInRecommendationResponse, IndividualRecommendationEnum, IndividualRecommendationZoneEnum, IUserAllData } from '../../types/dashboard.types';
import { IExpert, IExpertResponse } from '../../types/expert.types';
import { UserCategoryEnum } from '../../types/user.types';
import ActiveConsultation from '../ActiveConsultation';
import EmergencyAlertCard from './EmergencyAlertCard';
import { useBottomSheet } from '../bottomSheet/AppBottomSheet';
import HowToGenerateVivaScoreGuide from '../bottomSheet/HowToGenerateVivaScoreGuide';
import RecoveryProgressGraph from '../bottomSheet/RecoveryProgressGraph';
import RecoveryScoreBriefInfo from '../bottomSheet/RecoveryScoreBriefInfo';
import CareManagerCard from '../CareManagerCard';
import ExpertItem from '../experts/FLExpertItem';
import GradientButtonWithSlightRadius from '../GradientButtonWithSlightRadius';
import IndividualRecoveryCard from '../IndividualRecoveryCard';
import NNWomanPlanningForBaby from '../NNWomanPlanningForBaby';
import NPWomanBabyArriving from '../NPWomanBabyArriving';
import VivaScoreGauge from '../VivaScoreGauge';


const DashboardMotherTab = ({ userData, userActiveConsultationsData }: { userData: IUserAllData, userActiveConsultationsData: IUserActiveConsultations[] }) => {
    const { t } = useTranslation();
    const { language } = useLanguage();
    const [recentCheckindata, setRecentChekinData] = useState<ICheckInRecommendation[]>();
    const [experts, setExperts] = useState<IExpert[]>([]);

    const fetchRecentCheckIn = useCallback(async () => {
        const theRecentcheckinData = await getRecentCheckinData() as ICheckInRecommendationResponse;
        setRecentChekinData(theRecentcheckinData.data);
    }, []);

    const fetchExperts = useCallback(async () => {
        const response: IExpertResponse = await getExperts();
        setExperts(response.data);
    }, []);

    useEffect(() => {
        (async function () {
            // forground message received
            messaging().onMessage(async (remoteMessage: FirebaseMessagingTypes.RemoteMessage) => {
                console.log("remoteMessage.data inside Dashboard.tsx ==>> ", remoteMessage.data);
                fetchRecentCheckIn();
            });
        })()
    }, [fetchRecentCheckIn])

    // Fetch on mount and re-fetch whenever the language changes, so every
    // backend-driven section refreshes together in the selected language.
    useEffect(() => {
        fetchRecentCheckIn();
        fetchExperts();
    }, [language, fetchRecentCheckIn, fetchExperts]);

    useFocusEffect(
        useCallback(() => {
            fetchRecentCheckIn();
        }, [fetchRecentCheckIn])
    );

    useEffect(() => {
        console.log("[recentCheckindata] =>>>>", recentCheckindata)
    }, [recentCheckindata])

    const { open, close } = useBottomSheet();
    const shake = useSharedValue(0);
    const rotate = useSharedValue(0);

    // Three distinct states, resolved before render so she never taps into a paywall:
    //   locked  -> no entitlement at this tier; tap opens the paywall directly
    //   open    -> a check-in exists for this week and is unfinished; tappable all week
    //   waiting -> nothing to do; count down to the next one
    // The previous gate was `upcoming_checkin_due_days !== 0`, which unlocked the button
    // for exactly one day a week and left it permanently enabled for anyone whose
    // counters were never written.
    const checkinCapability = useCapability(Capability.CHECKIN_WEEKLY);
    const { openPaywall } = useSubscriptionContext();
    const activeCheckin = userData?.user.active_checkin ?? null;
    const checkinProgrammeEnded = userData?.user.checkin_programme_ended ?? false;

    const checkinState: 'locked' | 'open' | 'waiting' = checkinCapability.locked
        ? 'locked'
        : activeCheckin
            ? 'open'
            : 'waiting';

    // Days until the NEXT check-in opens. Derived from previous_checkin_due_days (days
    // into the current week) rather than read off upcoming_checkin_due_days, because that
    // counter is 0 on the day a check-in opens — meaning "one is available today", not
    // "the next one is 0 days away". Reading it directly made the label say
    // "0 days before your Weekly Check-in" to someone who had just completed one.
    const daysUntilNextCheckin = 7 - (userData?.user.current_weekdays.previous_checkin_due_days ?? 0);

    const checkinLabel =
        checkinState === 'locked'
            ? t('dashboard.unlockWeeklyCheckin')
            : checkinState === 'open'
                ? t('dashboard.completeWeeklyCheckin')
                : t('dashboard.daysBeforeCheckin', { days: daysUntilNextCheckin });

    const onCheckinPress = () => {
        if (checkinState === 'locked') {
            // Same payload the server would send on a 402, so PaywallSheet renders the
            // check-in copy — but without the wasted round-trip through a refusal.
            openPaywall({
                code: DenialCode.LOCKED_FEATURE,
                capability: Capability.CHECKIN_WEEKLY,
                tier: checkinCapability.tier,
                upsell: SubscriptionTier.PREMIUM,
            });
            return;
        }
        navigation.navigate('ChatWithVivaAI', { flowSlug: FLOW_SLUGS[FlowType.CHECKIN] });
    };

    // Temporarily hide the recovery-score gauge and individual recovery cards.
    // Typed as boolean (not the literal `false`) so it disables rendering without
    // breaking TypeScript's narrowing of `recentCheckindata` inside the blocks.
    const SHOW_RECOVERY: boolean = true;

    useFocusEffect(
        useCallback(() => {
            shake.value = withSequence(
                withTiming(-14, { duration: 160 }),
                withTiming(14, { duration: 160 }),
                withTiming(-10, { duration: 140 }),
                withTiming(10, { duration: 140 }),
                withTiming(-6, { duration: 120 }),
                withTiming(0, { duration: 160 })
            );

            rotate.value = withSequence(
                withTiming(-6, { duration: 200 }),
                withTiming(6, { duration: 200 }),
                withTiming(-4, { duration: 180 }),
                withTiming(3, { duration: 120 }),
                withTiming(0, { duration: 200 })
            );
        }, [shake, rotate])
    );

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ translateX: shake.value }, { rotateZ: `${rotate.value}deg` }],
    }));

    const navigation = useNavigation<any>();
    return (
        <View>
            {/* {
                userData && !userData.user.subscription.expiryDate && (

                    <View style={{ flexDirection: 'row' }}>
                        <LinearGradient
                            colors={[colors.purple, colors.darkPurple]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={{
                                borderRadius: 10,
                                flexDirection: "row",
                                justifyContent: "space-between",
                                alignItems: "center",
                                paddingVertical: 7,
                                paddingHorizontal: 10,
                                flex: 1,
                                marginBottom: 20,
                                gap: 15
                            }}
                        >
                            <Text
                                style={[
                                    {
                                        fontSize: 16,
                                        flexShrink: 1,
                                        color: colors.white,
                                    },
                                    globalStyles.fontSemiBold
                                ]}
                            >
                                Subscribe to viva recovery today
                            </Text>

                            <TouchableOpacity
                                onPress={() => navigation.navigate("Services")}
                                style={{
                                    paddingHorizontal: 5,
                                    paddingVertical: 5,
                                    flexShrink: 1,
                                    backgroundColor: colors.white,
                                    borderRadius: 15
                                }}
                            >
                                <Text
                                    style={[
                                        {
                                            fontSize: 14,
                                            flexShrink: 1,
                                            textAlign: "center",
                                            paddingHorizontal: 8,
                                            paddingVertical: 4,
                                            borderRadius: 6,
                                            color: colors.black
                                        },
                                        globalStyles.fontMedium
                                    ]}
                                >
                                    Try now
                                </Text>
                            </TouchableOpacity>
                        </LinearGradient>
                    </View>
                )
            } */}

            {/* Red-flag answers from the latest check-in sit above everything —
                this is the one card she must not scroll past. */}
            {recentCheckindata?.[0]?.emergencyAlert && (
                <EmergencyAlertCard
                    key={recentCheckindata[0].emergencyAlert.recommendationHistoryId}
                    alert={recentCheckindata[0].emergencyAlert}
                />
            )}

            <View
                style={{
                    marginBottom: 12,
                }}
            >
                <FlatList
                    keyExtractor={(item: IUserActiveConsultations) => item._id}
                    data={userActiveConsultationsData}
                    renderItem={({ item }) => <ActiveConsultation item={item} />}
                    scrollEnabled={false}
                    nestedScrollEnabled={false}
                />

            </View>
            <View>

                {/* gauge — hidden for now (recovery score + weekly check-in / mood / progress) */}
                {
                    SHOW_RECOVERY &&
                    userData &&
                    userData.user.user_category === UserCategoryEnum.PP &&
                    recentCheckindata && (
                        <View
                            style={{
                                backgroundColor: colors.white,
                                padding: 10,
                                borderRadius: 10,
                                boxShadow: '0 0 4px 0 rgba(0, 0, 0, 0.25)',
                                paddingBottom: 20,
                            }}
                        >
                            <View
                                style={{
                                    flexDirection: 'row',
                                    justifyContent: 'space-between',
                                    // alignItems: 'center',
                                    paddingHorizontal: 4,
                                }}
                            >

                                <View>

                                    <Text
                                        style={[{
                                            fontSize: 16,

                                        }, globalStyles.fontBold]}
                                    >
                                        {t('dashboard.recoveryScore')}
                                    </Text>
                                    <Text
                                        style={[{
                                            fontSize: 16,
                                            color: colors.darkPurple
                                        }, globalStyles.fontSemiBold]}
                                    >
                                        {t('dashboard.week', { week: recentCheckindata.length > 0 ? recentCheckindata[0].week : userData.user.current_weekdays.weeks })}
                                    </Text>
                                </View>
                                <View>
                                    <TouchableOpacity
                                        activeOpacity={0.1}
                                        onPress={() => {
                                            try {
                                                open(<HowToGenerateVivaScoreGuide />)
                                            } catch (error) {
                                                console.error('[Screen] Error calling open():', error)
                                            }
                                        }}
                                    >
                                        <Lucide name='info' size={20} color={colors.darkGray} />
                                    </TouchableOpacity>
                                </View>

                            </View>

                            <View
                                style={{
                                    paddingHorizontal: 20
                                }}
                            >
                                {/* Always show the latest score. It used to be zeroed
                                    whenever a check-in was not due that exact day, which
                                    blanked the gauge six days out of seven. */}
                                <VivaScoreGauge percentage={recentCheckindata[0]?.finalScore ?? 0} />

                                {

                                    recentCheckindata.length > 0 ? (<View style={{
                                        marginTop: -100,
                                        marginBottom: 5,
                                        alignItems: "center"
                                    }}>
                                        <View
                                            style={{
                                                flexDirection: "row",
                                                alignItems: "center",
                                                justifyContent: "center"
                                            }}
                                        >
                                            <Text style={{ color: colors.black, fontSize: 45, textAlign: "center", ...globalStyles.fontBold, marginTop: 10 }}>
                                                {
                                                    recentCheckindata.length > 0 ?
                                                        `${String(recentCheckindata[0].finalScore).split(".")[0]}` :
                                                        `${String(recentCheckindata[0].finalScore).split(".")[0]}`
                                                }
                                            </Text>
                                            <TouchableOpacity
                                                onPress={() => open(
                                                    <RecoveryScoreBriefInfo
                                                        significance={userData.significance[recentCheckindata[0].zone.toLowerCase() as keyof typeof userData.significance]}
                                                        briefInfo={userData.recoveryScoreBriefInfo[recentCheckindata[0].zone.toLowerCase() as keyof typeof userData.recoveryScoreBriefInfo]}
                                                        navigation={navigation}
                                                        onClose={close}
                                                    />
                                                )}
                                            >
                                                <Lucide name='info' size={15} color={colors.darkPurple} style={{ alignSelf: "center", marginTop: -10 }} />
                                            </TouchableOpacity>
                                        </View>
                                        <Text
                                            style={{
                                                fontSize: 14,
                                                textAlign: "center",
                                                ...globalStyles.fontSemiBold,
                                                marginTop: 10,

                                                backgroundColor: recentCheckindata[0].zone === IndividualRecommendationZoneEnum.RED ? colors.redBadgeBG : recentCheckindata[0].zone === IndividualRecommendationZoneEnum.YELLOW ? colors.yellowBadgeBG : colors.greenBadgeBG,

                                                color: recentCheckindata[0].zone === IndividualRecommendationZoneEnum.RED ? colors.redBadgeText : recentCheckindata[0].zone === IndividualRecommendationZoneEnum.YELLOW ? colors.yellowBadgeText : colors.greenBadgeText,

                                                paddingVertical: 6,
                                                paddingHorizontal: 18,
                                                borderRadius: 20
                                            }}>
                                            {recentCheckindata[0].tagline}
                                        </Text>
                                    </View>) : (
                                        <Animated.View
                                            style={[
                                                {
                                                    marginTop: -100,
                                                    marginBottom: 5,
                                                    alignItems: 'center',
                                                },
                                                animatedStyle,
                                            ]}
                                        >
                                            <Lucide name='hourglass' size={30} color={colors.darkPurple} style={{ alignSelf: "center", marginTop: 20 }} />
                                        </Animated.View>
                                    )
                                }

                                <Text style={[globalStyles.fontRegular, { fontSize: 10, color: colors.gray, textAlign: 'center', marginTop: 5, marginBottom: 10 }]}>
                                    {t('dashboard.scoreDisclaimer')}
                                </Text>

                                {/* {
                                    score && (

                                        <View style={{
                                            marginTop: -100,
                                            marginBottom: 20
                                        }}>
                                            <Text style={{ color: colors.black, fontSize: 40, textAlign: "center", ...globalStyles.fontSemiBold, marginTop: 10 }}>
                                                {
                                                    `${String(score).split(".")[0]}`
                                                }
                                            </Text>
                                        </View>
                                    )
                                } */}
                                {/* Weekly Check In */}
                                {

                                    <View
                                        style={{
                                        }}
                                    >

                                        {/* Past the end of the programme there is no next
                                            check-in to count down to, so the button is
                                            hidden rather than left showing a countdown
                                            that never unlocks. Mood log and the score
                                            history below stay available. */}
                                        {checkinProgrammeEnded ? null : (
                                            <>
                                                <TouchableOpacity
                                                    activeOpacity={0.8}
                                                    onPress={onCheckinPress}
                                                    // Only the countdown state is inert. Locked is
                                                    // tappable so it can explain itself.
                                                    disabled={checkinState === 'waiting'}
                                                    style={{
                                                        flexDirection: "row",
                                                        borderRadius: 30,
                                                        justifyContent: "center",
                                                        alignItems: "center",
                                                        paddingVertical: 15,
                                                        paddingHorizontal: 10,
                                                        flex: 1,
                                                        marginTop: 10,
                                                        borderWidth: 2,
                                                        borderColor: checkinState === 'waiting' ? colors.border : colors.purple
                                                    }}
                                                >
                                                    {checkinState === 'locked' ? (
                                                        <View style={{ marginRight: 6 }}>
                                                            <Lucide name='lock' size={16} color={colors.darkPurple} />
                                                        </View>
                                                    ) : null}
                                                    <Text
                                                        style={[{
                                                            color: checkinState === 'waiting' ? colors.gray : colors.darkPurple,
                                                            fontSize: 16,
                                                        }, globalStyles.fontBold]}
                                                    >
                                                        {checkinLabel}
                                                    </Text>
                                                    {checkinState === 'open' ? <View style={{ marginTop: 3, marginLeft: 5, zIndex: 99 }}>
                                                        <MaterialDesignIcons
                                                            name="arrow-right"
                                                            style={{
                                                                fontSize: 16,
                                                                color: colors.darkPurple,
                                                            }}
                                                        />
                                                    </View> : null}
                                                </TouchableOpacity>
                                                {checkinState === 'open' && activeCheckin ? (
                                                    <Text style={[globalStyles.fontRegular, {
                                                        fontSize: 11,
                                                        color: colors.gray,
                                                        textAlign: 'center',
                                                        marginTop: 6,
                                                    }]}>
                                                        {t('dashboard.checkinDaysLeft', { days: activeCheckin.daysLeft })}
                                                    </Text>
                                                ) : null}
                                            </>
                                        )}

                                        <TouchableOpacity
                                            activeOpacity={0.8}
                                            onPress={() => {
                                                navigation.navigate("MoodLog");
                                            }}
                                            style={{
                                                flexDirection: "row",
                                                borderRadius: 30,
                                                justifyContent: "center",
                                                alignItems: "center",
                                                paddingVertical: 15,
                                                paddingHorizontal: 10,
                                                flex: 1,
                                                marginTop: 10,
                                                borderWidth: 2,
                                                borderColor: colors.purple
                                            }}
                                        >
                                            <Text
                                                style={[{
                                                    color: colors.darkPurple,
                                                    fontSize: 16,
                                                }, globalStyles.fontBold]}
                                            >
                                                {t('dashboard.logMood')}
                                            </Text>
                                        </TouchableOpacity>

                                        {/* <TouchableOpacity
                                            activeOpacity={0.8}
                                            // onPress={() => {
                                            //     navigation.navigate("ChatWithVivaAI", {
                                            //         flowSlug: "sleep-log-v1",
                                            //     });
                                            // }}
                                            style={{
                                                flexDirection: "row",
                                                borderRadius: 30,
                                                justifyContent: "center",
                                                alignItems: "center",
                                                paddingVertical: 15,
                                                paddingHorizontal: 10,
                                                flex: 1,
                                                marginTop: 10,
                                                borderWidth: 2,
                                                borderColor: colors.purple
                                            }}
                                        >
                                            <Text
                                                style={[{
                                                    color: colors.darkPurple,
                                                    fontSize: 16,
                                                }, globalStyles.fontBold]}
                                            >
                                                Log your Sleep
                                            </Text>
                                        </TouchableOpacity> */}
                                    </View>

                                }

                                {
                                    recentCheckindata.length > 0 && (
                                        <View
                                            style={{
                                                flexDirection: 'row',

                                            }}
                                        >
                                            <GradientButtonWithSlightRadius
                                                title={t('dashboard.seeProgress')}
                                                fullRounded={true}
                                                onPress={() => open(
                                                    <View style={{ flex: 1 }}>
                                                        <RecoveryProgressGraph />
                                                    </View>
                                                )}
                                            />
                                        </View>
                                    )
                                }

                            </View>
                        </View>
                    )
                }


                {/* individual recovery cards — hidden for now (physical / lactation / emotional) */}
                {
                    SHOW_RECOVERY &&
                    userData &&
                    userData.user.user_category === UserCategoryEnum.PP &&
                    recentCheckindata && recentCheckindata.length > 0 && (
                        <>
                            {/* Physical Recovery */}
                            {
                                recentCheckindata[0].individualRecommendations.physical.recommendation.title && (
                                    <IndividualRecoveryCard type={IndividualRecommendationEnum.PHYSICAL} data={recentCheckindata[0].individualRecommendations.physical} />
                                )
                            }

                            {/* Lactation Recovery */}
                            {
                                recentCheckindata[0].individualRecommendations.lactation.recommendation.title && (
                                    <IndividualRecoveryCard type={IndividualRecommendationEnum.LACTATION} data={recentCheckindata[0].individualRecommendations.lactation} />
                                )
                            }

                            {/* Emotional Recovery */}
                            {
                                recentCheckindata[0].individualRecommendations.emotional && (
                                    <IndividualRecoveryCard type={IndividualRecommendationEnum.EMOTIONAL} data={recentCheckindata[0].individualRecommendations.emotional} />
                                )
                            }

                        </>
                    )
                }


                {
                    userData &&
                    userData.user.user_category === UserCategoryEnum.NP && (
                        <NPWomanBabyArriving userData={userData.user} />
                    )
                }
                {
                    userData &&
                    userData.user.user_category === UserCategoryEnum.NN && (
                        <NNWomanPlanningForBaby />
                    )
                }



                <CareManagerCard />
                <Text style={[globalStyles.fontRegular, { fontSize: 10, color: colors.gray, marginTop: 5, marginBottom: 15, textAlign: "center" }]}>
                    {t('dashboard.careManagerDisclaimer')}
                </Text>

                {/* Consult an Expert */}

                <FlatList
                    keyExtractor={(item: IExpert) => item._id}
                    data={experts.slice(0, 4)}
                    renderItem={({ item }) => <ExpertItem item={item} navigation={navigation} />}
                    columnWrapperStyle={{
                        justifyContent: 'space-between',
                        alignItems: 'flex-end',
                        gap: 10,
                        marginBottom: 10
                    }}
                    numColumns={2}
                    scrollEnabled={false}
                    nestedScrollEnabled={false}
                    ListHeaderComponent={() => (
                        <View
                            style={{
                                marginBottom: 15
                            }}
                        >

                            <View
                                style={{
                                    marginTop: 25
                                }}
                            >
                                <Text
                                    style={[{
                                        fontSize: 20,
                                        fontWeight: '600',
                                    }, globalStyles.fontBold]}
                                >
                                    {t('dashboard.connectHealthcare')}
                                </Text>
                                <Text style={[globalStyles.fontRegular, { fontSize: 10, color: colors.gray, marginTop: 5 }]}>
                                    {t('dashboard.consultationDisclaimer')}
                                </Text>
                            </View>
                        </View>
                    )}

                    ListFooterComponent={() => (
                        <View
                            style={{
                                marginBottom: 10
                            }}
                        >
                            <GradientButtonWithSlightRadius
                                title={t('dashboard.seeAllExperts')}
                                fullRounded={true}
                                fullWidth={true}
                                onPress={() => {
                                    navigation.navigate("Experts")
                                }}
                            />
                        </View>
                    )}
                />

                {/* Recommendations */}
                {/* <View
                    style={{
                        marginTop: 40
                    }}
                >
                    <View
                        style={{
                            flexDirection: 'row',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                        }}
                    >
                        <Text
                            style={[{
                                fontSize: 20,
                                color: colors.black
                            }, globalStyles.fontBold]}
                        >
                            Recommendations
                        </Text>
                        <Text
                            onPress={() => navigation.navigate("Recommendations")}
                            style={[{
                                fontSize: 16,
                                color: colors.black
                            }, globalStyles.fontRegular]}
                        >
                            See All
                        </Text>
                    </View>
                    <FlatList
                        keyExtractor={(item, index) => index.toString()}
                        data={recommendationsData.slice(0, 2)}
                        renderItem={({ item }) => FLItemRecommendation({ item, navigation, onlyTitle: true })}
                        style={{
                            marginVertical: 10
                        }}
                        scrollEnabled={false}
                        numColumns={2}
                        columnWrapperStyle={{
                            gap: 10,
                            justifyContent: 'space-between'
                        }}
                    />
                </View> */}

            </View>
        </View>
    )
}

export default DashboardMotherTab