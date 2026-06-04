import messaging, { FirebaseMessagingTypes } from '@react-native-firebase/messaging';
import Lucide from '@react-native-vector-icons/lucide';
import MaterialDesignIcons from "@react-native-vector-icons/material-design-icons";
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, Text, TouchableOpacity, View } from 'react-native';
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withSequence,
    withTiming,
} from 'react-native-reanimated';
import { getExperts } from '../../api/getExperts';
import { getRecentCheckinData } from '../../api/recentCheckIn.api';
import { colors } from '../../public/assets/colors';
import { globalStyles } from '../../public/styles';
import { IUserActiveConsultations } from '../../types/consultation.types';
import { ICheckInRecommendation, ICheckInRecommendationResponse, IndividualRecommendationEnum, IndividualRecommendationZoneEnum, IUserAllData } from '../../types/dashboard.types';
import { IExpert, IExpertResponse } from '../../types/expert.types';
import { UserCategoryEnum } from '../../types/user.types';
import ActiveConsultation from '../ActiveConsultation';
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
    const [recentCheckindata, setRecentChekinData] = useState<ICheckInRecommendation[]>();
    const [experts, setExperts] = useState<IExpert[]>([]);

    const fetchRecentCheckIn = useCallback(async () => {
        const theRecentcheckinData = await getRecentCheckinData() as ICheckInRecommendationResponse;
        setRecentChekinData(theRecentcheckinData.data);
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

    useEffect(() => {
        (async () => {
            const response: IExpertResponse = await getExperts();
            setExperts(response.data);
        })();
    }, []);

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

    const upcomingCheckinDays = userData?.user.current_weekdays.upcoming_checkin_due_days;

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

            <View
                style={{
                    marginBottom: 12
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

                {/* gauge */}
                {
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
                                        Viva Recovery Score
                                    </Text>
                                    <Text
                                        style={[{
                                            fontSize: 16,
                                            color: colors.darkPurple
                                        }, globalStyles.fontSemiBold]}
                                    >
                                        Week {recentCheckindata.length > 0 ? recentCheckindata[0].week : userData.user.current_weekdays.weeks}
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
                                <VivaScoreGauge percentage={userData?.user.current_weekdays.upcoming_checkin_due_days !== 0 ? recentCheckindata[0]?.finalScore : 0} />

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
                                    This score is for personal reflection only. It is not a medical assessment. Always consult a qualified healthcare professional for medical advice.
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

                                        <TouchableOpacity
                                            activeOpacity={0.8}
                                            onPress={() => {
                                                navigation.navigate("ChatWithVivaAI", {
                                                    flowSlug: "weekly-check-in-v1",
                                                });
                                            }}
                                            disabled={userData?.user.current_weekdays.upcoming_checkin_due_days !== 0 ? true : false}
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
                                                {upcomingCheckinDays === 0 ? "Complete your Weekly Check-in" : `${upcomingCheckinDays} days before your Weekly Check-in`}
                                            </Text>
                                            {upcomingCheckinDays === 0 ? <View style={{ marginTop: 3, marginLeft: 5, zIndex: 99 }}>
                                                <MaterialDesignIcons
                                                    name="arrow-right"
                                                    style={{
                                                        fontSize: 16,
                                                        color: colors.darkPurple,
                                                    }}
                                                />
                                            </View> : null}
                                        </TouchableOpacity>

                                        {/* <TouchableOpacity
                                            activeOpacity={0.8}
                                            // onPress={() => {
                                            //     navigation.navigate("ChatWithVivaAI", {
                                            //         flowSlug: "mood-log-v1",
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
                                                Log your Mood
                                            </Text>
                                        </TouchableOpacity>

                                        <TouchableOpacity
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
                                                title='See Progress'
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


                {
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

                            {/* <WeekCycle /> */}
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
                    The Care Manager is a support coordinator, not a clinician. For medical questions, please consult a qualified healthcare professional.
                </Text>

                {/* Consult an Expert */}

                <FlatList
                    keyExtractor={(item: IExpert) => item._id}
                    data={experts.slice(0, 4)}
                    renderItem={({ item }) => ExpertItem({ item, navigation })}
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
                                    Connect with a healthcare professional
                                </Text>
                                <Text style={[globalStyles.fontRegular, { fontSize: 10, color: colors.gray, marginTop: 5 }]}>
                                    The consultation will be conducted by an independent healthcare professional. Any clinical advice, diagnosis, or treatment is provided by them, not by VivaMama. Please share relevant information clearly during the consultation.
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
                                title='See all experts'
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