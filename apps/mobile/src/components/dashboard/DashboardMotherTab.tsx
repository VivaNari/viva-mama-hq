import Lucide from '@react-native-vector-icons/lucide'
import { useFocusEffect, useNavigation } from '@react-navigation/native'
import React, { useCallback, useEffect, useState } from 'react'
import { FlatList, Text, TouchableOpacity, View } from 'react-native'
import LinearGradient from 'react-native-linear-gradient'
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withSequence,
    withTiming,
} from 'react-native-reanimated'
import { getRecentCheckinData } from '../../api/recentCheckIn.api'
import { expertData } from '../../data/expertData'
import { colors } from '../../public/assets/colors'
import { globalStyles } from '../../public/styles'
import { ICheckInRecommendation, ICheckInRecommendationResponse, IndividualRecommendationEnum, IndividualRecommendationZoneEnum, IUserAllData } from '../../types/dashboard.types'
import { IExpertCategory } from '../../types/expert.types'
import { UserCategoryEnum } from '../../types/user.types'
import { useBottomSheet } from '../bottomSheet/AppBottomSheet'
import HowToGenerateVivaScoreGuide from '../bottomSheet/HowToGenerateVivaScoreGuide'
import RecoveryProgressGraph from '../bottomSheet/RecoveryProgressGraph'
import RecoveryScoreBriefInfo from '../bottomSheet/RecoveryScoreBriefInfo'
import CareManagerCard from '../CareManagerCard'
import ExpertCategoryItem from '../experts/FLExpertCategoryItem'
import GradientButtonWithSlightRadius from '../GradientButtonWithSlightRadius'
import IndividualRecoveryCard from '../IndividualRecoveryCard'
import NNWomanPlanningForBaby from '../NNWomanPlanningForBaby'
import NPWomanBabyArriving from '../NPWomanBabyArriving'
import VivaScoreGauge from '../VivaScoreGauge'
import WeekCycle from '../WeekCycle'
const data = {
    recommendation: {
        title: "string",
        goingWell: "string;",
        needsHelp: "string",
        celebrate: ["string[]"],
        tips: ["string[]"],
        next: ["string[]"],
    },
    score: 30,
    zone: "RED"
}
const DashboardMotherTab = ({ score, userData }: { score: number, userData: IUserAllData }) => {
    const [recentCheckindata, setRecentChekinData] = useState<ICheckInRecommendation[]>();
    useEffect(() => {
        (async function () {
            const theRecentcheckinData = await getRecentCheckinData() as ICheckInRecommendationResponse;
            setRecentChekinData(theRecentcheckinData.data)
        })();
    }, [])

    const { open } = useBottomSheet();
    const shake = useSharedValue(0);
    const rotate = useSharedValue(0);

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
            <View style={{ flexDirection: 'row' }}>
                <LinearGradient
                    colors={['rgba(190, 163, 248, 1)', 'rgba(94, 141, 255, 1)']}
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
                        marginTop: 10,
                        gap: 15
                    }}
                >
                    {/* Left Text */}
                    <Text
                        style={[
                            {
                                fontSize: 14,
                                flexShrink: 1,
                                color: colors.white,
                            },
                            globalStyles.fontRegular
                        ]}
                    >
                        Subscribe to viva recovery today
                    </Text>

                    {/* Button Text */}
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
            <View>
                {/* gauge */}
                {
                    userData &&
                    userData.user.user_category === UserCategoryEnum.PP &&
                    (
                        <View
                            style={{
                                backgroundColor: 'rgba(255, 250, 250, 1)',
                                padding: 10,
                                borderRadius: 10,
                                marginTop: 15,
                                boxShadow: '0 0 4px 0 rgba(0, 0, 0, 0.25)',
                                paddingBottom: 20
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

                                        }, globalStyles.fontRegular]}
                                    >
                                        Week 1
                                    </Text>
                                </View>
                                <View>
                                    <TouchableOpacity
                                        activeOpacity={0.1}
                                        onPress={() =>
                                            open(<HowToGenerateVivaScoreGuide />)
                                        }
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
                                {/* <VivaScoreGauge percentage={Math.trunc(score ? score : userData.user.current_weekdays.upcoming_checkin_due_days !== 0 ? recentCheckindata[0]?.finalScore : 0)} /> */}
                                <VivaScoreGauge percentage={27} />

                                {


                                    userData.user.current_weekdays.upcoming_checkin_due_days !== 0 ? (<View style={{
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
                                            <Text style={{ color: colors.black, fontSize: 40, textAlign: "center", ...globalStyles.fontSemiBold, marginTop: 10 }}>
                                                {
                                                    3
                                                }
                                            </Text>
                                            <TouchableOpacity
                                                onPress={() => open(
                                                    // <RecoveryScoreBriefInfo
                                                    //     significance={userData.significance[recentCheckindata[0].zone.toLowerCase() as keyof typeof userData.significance]}
                                                    //     briefInfo={userData.recoveryScoreBriefInfo[recentCheckindata[0].zone.toLowerCase() as keyof typeof userData.recoveryScoreBriefInfo]}
                                                    // />
                                                    <RecoveryScoreBriefInfo
                                                        significance={"test"}
                                                        briefInfo={"tesst"}
                                                    />
                                                )}
                                            >
                                                <Lucide name='info' size={15} color={colors.primary} style={{ alignSelf: "center", marginTop: -10 }} />
                                            </TouchableOpacity>
                                        </View>
                                        <Text
                                            style={{
                                                fontSize: 14,
                                                textAlign: "center",
                                                ...globalStyles.fontRegular,
                                                marginTop: 10,

                                                //backgroundColor: recentCheckindata[0].zone === IndividualRecommendationZoneEnum.RED ? colors.redBadgeBG : recentCheckindata[0].zone === IndividualRecommendationZoneEnum.YELLOW ? colors.yellowBadgeBG : colors.greenBadgeBG,
                                                backgroundColor: colors.redBadgeBG,
                                                color: colors.redBadgeText,
                                                //color: recentCheckindata[0].zone === IndividualRecommendationZoneEnum.RED ? colors.redBadgeText : recentCheckindata[0].zone === IndividualRecommendationZoneEnum.YELLOW ? colors.yellowBadgeText : colors.greenBadgeText,

                                                paddingVertical: 6,
                                                paddingHorizontal: 18,
                                                borderRadius: 20
                                            }}>
                                            {/* {recentCheckindata[0].tagline} */}
                                            tagline
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
                                            <Lucide name='hourglass' size={30} color={colors.primary} style={{ alignSelf: "center", marginTop: 20 }} />
                                        </Animated.View>
                                    )
                                }
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
                                    userData.user.current_weekdays.upcoming_checkin_due_days === 0 && (
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
                                                style={{
                                                    borderRadius: 30,
                                                    justifyContent: "center",
                                                    alignItems: "center",
                                                    paddingVertical: 15,
                                                    paddingHorizontal: 10,
                                                    flex: 1,
                                                    marginTop: 10,
                                                    backgroundColor: colors.subscriptionTabInactiveBG
                                                }}
                                            >
                                                <Text
                                                    style={[{
                                                        color: colors.white,
                                                        fontSize: 14,
                                                    }, globalStyles.fontSemiBold]}
                                                >
                                                    New weekly check-in available
                                                </Text>
                                            </TouchableOpacity>
                                        </View>
                                    )
                                }

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

                            </View>
                        </View>
                    )
                }



                {
                    userData &&
                    userData.user.user_category === UserCategoryEnum.PP &&
                    (
                        <>
                            {/* Physical Recovery */}
                            <IndividualRecoveryCard type={IndividualRecommendationEnum.PHYSICAL} data={data} />

                            {/* Lactation Recovery */}
                            <IndividualRecoveryCard type={IndividualRecommendationEnum.LACTATION} data={data} />
                            {/* Emotional Recovery */}

                            <IndividualRecoveryCard type={IndividualRecommendationEnum.EMOTIONAL} data={data} />

                            <WeekCycle />
                        </>
                    )
                }


                {/* <View
                    style={{
                        backgroundColor: 'rgba(255, 250, 250, 1)',
                        marginTop: 20,
                    }}
                >
                    <ImageBackground
                        source={require('../../public/assets/images/lactation.png')}
                        resizeMode="cover"
                        style={{
                            width: '100%',
                            padding: 10,
                            borderRadius: 10,
                            overflow: 'hidden',
                            boxShadow: '0 0 4px 0 rgba(0, 0, 0, 0.25)',
                            paddingBottom: 20

                        }}>
                        <View
                            style={{
                                ...StyleSheet.absoluteFillObject,
                                backgroundColor: 'rgba(255, 250, 250, 0.90)',
                            }}
                        />
                        <View
                            style={{
                                flexDirection: 'row',
                                justifyContent: 'space-between',
                            }}
                        >
                            <View
                                style={{
                                    alignItems: 'flex-start',
                                }}
                            >

                                <Text
                                    style={[{
                                        fontSize: 16,

                                    }, globalStyles.fontBold]}
                                >
                                    Lactation Wellness
                                </Text>
                                <Text
                                    style={[{
                                        fontSize: 12,
                                        backgroundColor: colors.yellowBadgeBG,
                                        color: colors.yellowBadgeText,
                                        paddingVertical: 4,
                                        paddingHorizontal: 10,
                                        borderRadius: 20,
                                        marginTop: 6,

                                    }, globalStyles.fontRegular]}
                                >
                                    Steady Progress
                                </Text>
                            </View>
                            <Lucide name='chart-no-axes-combined' size={20} color={colors.yellowBadgeText} />
                        </View>

                        <View style={{ marginTop: 20 }}>
                            <View
                                style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    marginVertical: 6
                                }}
                            >
                                <Lucide
                                    name="lightbulb"
                                    size={18}
                                    color={colors.yellowBadgeText}
                                    style={{ marginRight: 6 }}
                                />

                                <Text style={[globalStyles.fontRegular, { color: colors.darkGray }]}>
                                    <Text style={globalStyles.fontBold}>Tips: </Text>
                                    Remember to stay hydrated and take short walks to boost your recovery.
                                </Text>
                            </View>
                            <View
                                style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    marginVertical: 6
                                }}
                            >
                                <Lucide
                                    name="lightbulb"
                                    size={18}
                                    color={colors.yellowBadgeText}
                                    style={{ marginRight: 6 }}
                                />

                                <Text style={[globalStyles.fontRegular, { color: colors.darkGray }]}>
                                    <Text style={globalStyles.fontBold}>Going well: </Text>
                                    Your energy levels are steadily increasing.
                                </Text>
                            </View>
                            <View
                                style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    marginVertical: 6
                                }}
                            >
                                <Lucide
                                    name="lightbulb"
                                    size={18}
                                    color={colors.yellowBadgeText}
                                    style={{ marginRight: 6 }}
                                />

                                <Text style={[globalStyles.fontRegular, { color: colors.darkGray }]}>
                                    <Text style={globalStyles.fontBold}>Next: </Text>
                                    Schedule a follow-up appointment with your healthcare provider in two weeks.
                                </Text>
                            </View>
                        </View>


                    </ImageBackground>
                </View>

                <View
                    style={{
                        backgroundColor: 'rgba(255, 250, 250, 1)',
                        marginTop: 20,
                    }}
                >
                    <ImageBackground
                        source={require('../../public/assets/images/emotional.png')}
                        resizeMode="cover"
                        style={{
                            width: '100%',
                            padding: 10,
                            borderRadius: 10,
                            overflow: 'hidden',
                            boxShadow: '0 0 4px 0 rgba(0, 0, 0, 0.25)',
                            paddingBottom: 20

                        }}>
                        <View
                            style={{
                                ...StyleSheet.absoluteFillObject,
                                backgroundColor: 'rgba(255, 250, 250, 0.90)',
                            }}
                        />
                        <View
                            style={{
                                flexDirection: 'row',
                                justifyContent: 'space-between',
                            }}
                        >
                            <View
                                style={{
                                    alignItems: 'flex-start',
                                }}
                            >

                                <Text
                                    style={[{
                                        fontSize: 16,

                                    }, globalStyles.fontBold]}
                                >
                                    Emotional Wellness
                                </Text>
                                <Text
                                    style={[{
                                        fontSize: 12,
                                        backgroundColor: colors.redBadgeBG,
                                        color: colors.redBadgeText,
                                        paddingVertical: 4,
                                        paddingHorizontal: 10,
                                        borderRadius: 20,
                                        marginTop: 6,

                                    }, globalStyles.fontRegular]}
                                >
                                    Decreasing
                                </Text>
                            </View>
                            <Lucide name='chart-no-axes-combined' size={20} color={colors.redBadgeText} style={{
                                transform: 'scaleX(-1)'
                            }} />
                        </View>

                        <View style={{ marginTop: 20 }}>
                            <View
                                style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    marginVertical: 6
                                }}
                            >
                                <Lucide
                                    name="lightbulb"
                                    size={18}
                                    color={colors.redBadgeText}
                                    style={{ marginRight: 6 }}
                                />

                                <Text style={[globalStyles.fontRegular, { color: colors.darkGray }]}>
                                    <Text style={globalStyles.fontBold}>Tips: </Text>
                                    Remember to stay hydrated and take short walks to boost your recovery.
                                </Text>
                            </View>
                            <View
                                style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    marginVertical: 6
                                }}
                            >
                                <Lucide
                                    name="lightbulb"
                                    size={18}
                                    color={colors.redBadgeText}
                                    style={{ marginRight: 6 }}
                                />

                                <Text style={[globalStyles.fontRegular, { color: colors.darkGray }]}>
                                    <Text style={globalStyles.fontBold}>Going well: </Text>
                                    Your energy levels are steadily increasing.
                                </Text>
                            </View>
                            <View
                                style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    marginVertical: 6
                                }}
                            >
                                <Lucide
                                    name="lightbulb"
                                    size={18}
                                    color={colors.redBadgeText}
                                    style={{ marginRight: 6 }}
                                />

                                <Text style={[globalStyles.fontRegular, { color: colors.darkGray }]}>
                                    <Text style={globalStyles.fontBold}>Next: </Text>
                                    Schedule a follow-up appointment with your healthcare provider in two weeks.
                                </Text>
                            </View>
                        </View>


                    </ImageBackground>
                </View> */}


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

                {/* Consult an Expert */}
                <FlatList
                    keyExtractor={(item: IExpertCategory) => item.id.toString()}
                    data={expertData.slice(0, 2)}
                    renderItem={({ item }) => ExpertCategoryItem({ item, navigation })}
                    // style={{}}
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
                                    Consult an expert
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