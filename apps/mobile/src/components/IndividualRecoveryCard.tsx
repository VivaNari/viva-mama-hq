import Lucide from '@react-native-vector-icons/lucide'
import React from 'react'
import { ImageBackground, StyleSheet, Text, View } from 'react-native'
import { colors } from '../public/assets/colors'
import { globalStyles } from '../public/styles'
import { ICheckInRecommendation, IndividualRecommendationEnum, IndividualRecommendationZoneEnum } from '../types/dashboard.types'

const IndividualRecoveryCard = ({
    type,
    data
}: {
    type: IndividualRecommendationEnum;
    data: ICheckInRecommendation["individualRecommendations"][IndividualRecommendationEnum.PHYSICAL] | ICheckInRecommendation["individualRecommendations"][IndividualRecommendationEnum.LACTATION] | ICheckInRecommendation["individualRecommendations"][IndividualRecommendationEnum.EMOTIONAL];
}) => {
    return (
        <View
            style={{
                backgroundColor: 'rgba(255, 250, 250, 1)',
                marginTop: 20,
            }}
        >
            <ImageBackground
                source={type === IndividualRecommendationEnum.PHYSICAL ? require('../public/assets/images/physical.png') : type === IndividualRecommendationEnum.LACTATION ? require('../public/assets/images/lactation.png') : require('../public/assets/images/emotional.png')}
                resizeMode="cover"
                style={{
                    width: '100%',
                    padding: 10,
                    borderRadius: 10,
                    overflow: 'hidden',
                    boxShadow: '0 0 4px 0 rgba(0, 0, 0, 0.25)',
                    paddingBottom: 20,

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
                            {type === IndividualRecommendationEnum.PHYSICAL ? 'Physical Wellness' : type === IndividualRecommendationEnum.LACTATION ? 'Lactation Wellness' : 'Emotional Wellness'}
                        </Text>
                        <Text
                            style={[{
                                fontSize: 12,
                                backgroundColor: data.zone === IndividualRecommendationZoneEnum.RED ? colors.redBadgeBG : data.zone === IndividualRecommendationZoneEnum.YELLOW ? colors.yellowBadgeBG : colors.greenBadgeBG,
                                color: data.zone === IndividualRecommendationZoneEnum.RED ? colors.redBadgeText : data.zone === IndividualRecommendationZoneEnum.YELLOW ? colors.yellowBadgeText : colors.greenBadgeText,
                                paddingVertical: 4,
                                paddingHorizontal: 10,
                                borderRadius: 20,
                                marginTop: 6,

                            }, globalStyles.fontRegular]}
                        >
                            {data.recommendation.title}
                        </Text>
                    </View>
                    <Lucide
                        name='chart-no-axes-combined'
                        size={20}
                        color={
                            data.zone === IndividualRecommendationZoneEnum.RED ?
                                colors.redBadgeText : data.zone === IndividualRecommendationZoneEnum.YELLOW ?
                                    colors.yellowBadgeText : colors.greenBadgeText
                        }
                        style={{
                            transform: data.zone === IndividualRecommendationZoneEnum.RED ? 'scaleX(-1)' : 'none'
                        }}
                    />
                </View>

                <View style={{ marginTop: 20 }}>
                    {
                        data.recommendation.tips && data.recommendation.tips.length > 0 && (
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
                                    color={data.zone === IndividualRecommendationZoneEnum.RED ? colors.redBadgeText : data.zone === IndividualRecommendationZoneEnum.YELLOW ? colors.yellowBadgeText : colors.greenBadgeText}
                                    style={{ marginRight: 6 }}
                                />

                                <Text style={[globalStyles.fontRegular, {
                                    color: colors.darkGray,
                                    flex: 1,
                                    flexShrink: 1,
                                }]}>
                                    <Text style={globalStyles.fontBold}>Tips: </Text>
                                    {data.recommendation.tips.join(', ')}
                                </Text>
                            </View>
                        )
                    }

                    {
                        data.recommendation.goingWell && (
                            <View
                                style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    marginVertical: 6,
                                }}
                            >
                                <Lucide
                                    name="lightbulb"
                                    size={18}
                                    color={data.zone === IndividualRecommendationZoneEnum.RED ? colors.redBadgeText : data.zone === IndividualRecommendationZoneEnum.YELLOW ? colors.yellowBadgeText : colors.greenBadgeText}
                                    style={{ marginRight: 6 }}
                                />

                                <Text style={[globalStyles.fontRegular, {
                                    color: colors.darkGray,
                                    flex: 1,
                                    flexShrink: 1,
                                }]}>
                                    <Text style={globalStyles.fontBold}>Going well: </Text>
                                    {data.recommendation.goingWell}
                                </Text>
                            </View>
                        )
                    }

                    {
                        data.recommendation.next && data.recommendation.next.length > 0 && (
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
                                    color={data.zone === IndividualRecommendationZoneEnum.RED ? colors.redBadgeText : data.zone === IndividualRecommendationZoneEnum.YELLOW ? colors.yellowBadgeText : colors.greenBadgeText}
                                    style={{ marginRight: 6 }}
                                />

                                <Text style={[globalStyles.fontRegular, {
                                    color: colors.darkGray,
                                    flex: 1,
                                    flexShrink: 1
                                }]}>
                                    <Text style={globalStyles.fontBold}>Next: </Text>
                                    {data.recommendation.next.join(', ')}
                                </Text>
                            </View>
                        )
                    }

                    {
                        data.recommendation.needsHelp && (
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
                                    color={data.zone === IndividualRecommendationZoneEnum.RED ? colors.redBadgeText : data.zone === IndividualRecommendationZoneEnum.YELLOW ? colors.yellowBadgeText : colors.greenBadgeText}
                                    style={{ marginRight: 6 }}
                                />

                                <Text style={[globalStyles.fontRegular, {
                                    color: colors.darkGray,
                                    flex: 1,
                                    flexShrink: 1
                                }]}>
                                    <Text style={globalStyles.fontBold}>Needs Help: </Text>
                                    {data.recommendation.needsHelp}
                                </Text>
                            </View>
                        )
                    }

                    {
                        data.recommendation.celebrate && data.recommendation.celebrate.length > 0 && (
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
                                    color={data.zone === IndividualRecommendationZoneEnum.RED ? colors.redBadgeText : data.zone === IndividualRecommendationZoneEnum.YELLOW ? colors.yellowBadgeText : colors.greenBadgeText}
                                    style={{ marginRight: 6 }}
                                />

                                <Text style={[globalStyles.fontRegular, {
                                    color: colors.darkGray,
                                    flex: 1,
                                    flexShrink: 1
                                }]}>
                                    <Text style={globalStyles.fontBold}>Celebrate: </Text>
                                    {data.recommendation.celebrate.join(', ')}
                                </Text>
                            </View>
                        )
                    }
                </View>


            </ImageBackground>
        </View>
    )
}

export default IndividualRecoveryCard