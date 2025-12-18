import { useNavigation } from '@react-navigation/native'
import React from 'react'
import { FlatList, Text, TouchableOpacity, View } from 'react-native'
import LinearGradient from 'react-native-linear-gradient'
import { fullReportData } from '../../data/fullReportData'
import { colors } from '../../public/assets/colors'
import { globalStyles } from '../../public/styles'
import GradientButtonWithSlightRadius from '../GradientButtonWithSlightRadius'
import VivaScoreGauge from '../VivaScoreGauge'
import FLItemRecommendation from '../recommendations/FLItemRecommendation'
import { recommendationsData } from '../../data/recommendationsData'

const DashboardMotherTab = ({ score }: { score: string | null }) => {
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
                            Try now for free
                        </Text>
                    </TouchableOpacity>
                </LinearGradient>
            </View>
            <View>
                {/* gauge */}
                <View
                    style={{
                        backgroundColor: 'rgba(255, 250, 250, 1)',
                        padding: 10,
                        borderRadius: 20,
                        marginTop: 15,
                        boxShadow: '0 0 4px 0 rgba(0, 0, 0, 0.25)'
                    }}
                >
                    <View
                        style={{
                            flexDirection: 'row',
                            justifyContent: 'space-between',
                            alignItems: 'center',
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
                                    fontSize: 10,

                                }, globalStyles.fontRegular]}
                            >
                                Based on the weekly check-in
                            </Text>
                        </View>
                        <Text
                            style={[{
                                fontSize: 16,

                            }, globalStyles.fontRegular]}
                        >
                            Week {fullReportData.weekNumber}
                        </Text>

                    </View>

                    <View
                        style={{
                            paddingHorizontal: 20
                        }}
                    >
                        <VivaScoreGauge percentage={fullReportData.vivaRecoveryScroreInPercentage} />


                        {
                            score && (

                                <View style={{
                                    marginTop: -100,
                                }}>
                                    <Text style={{ color: colors.black, fontSize: 40, textAlign: "center", ...globalStyles.fontSemiBold, marginTop: 10 }}>
                                        {
                                            `${String(score).split(".")[0]}`
                                        }
                                    </Text>
                                </View>
                            )
                        }
                        <View
                            style={{
                                flexDirection: 'row',

                            }}
                        >
                            <GradientButtonWithSlightRadius
                                title='View Full Report'
                                fullRounded={true}
                                onPress={() => { navigation.navigate('FullReport') }}
                            />
                        </View>
                    </View>
                </View>


                {/* Weekly Check In */}
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
                                fontSize: 16,
                            }, globalStyles.fontSemiBold]}
                        >
                            Weekly Check In
                        </Text>
                    </TouchableOpacity>
                </View>

                {/* Recommendations */}
                <View
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
                </View>

            </View>
        </View>
    )
}

export default DashboardMotherTab