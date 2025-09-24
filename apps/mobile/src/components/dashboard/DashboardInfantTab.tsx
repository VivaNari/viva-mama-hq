import React from 'react'
import { FlatList, Image, Text, TouchableOpacity, View } from 'react-native'
import { colors } from '../../public/assets/colors'
import { globalStyles } from '../../public/styles'
import { infantData } from '../../data/infantData'
import FLInfantCheckInOptions from './FLInfantCheckInOptions'
import { useNavigation } from '@react-navigation/native'

const DashboardInfantTab = () => {
    const navigation = useNavigation<any>();
    return (
        <View>
            <View style={{ flexDirection: 'row' }}>
                <View
                    style={{
                        backgroundColor: 'rgba(94, 141, 255, 1)',
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
                        You child vaccination is due on 27 august
                    </Text>

                    {/* Button Text */}
                    <TouchableOpacity style={{
                        paddingHorizontal: 5,
                        paddingVertical: 5,
                        flexShrink: 1,
                        backgroundColor: colors.white,
                        borderRadius: 15
                    }}>
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
                            Remind me later
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>
            <View>
                {/* Score display */}
                <View
                    style={{
                        backgroundColor: 'rgba(255, 250, 250, 1)',
                        padding: 10,
                        borderRadius: 20,
                        marginTop: 15,
                        boxShadow: '0 0 4px 0 rgba(0, 0, 0, 0.25)'
                    }}
                >
                    <View>


                        <Text
                            style={[{
                                fontSize: 16,

                            }, globalStyles.fontBold]}
                        >
                            Infant age - {infantData.age}
                        </Text>
                        <Text
                            style={[{
                                fontSize: 10,

                            }, globalStyles.fontRegular]}
                        >
                            Infant growth score
                        </Text>

                    </View>
                    <View
                    >
                        <Image
                            source={infantData.scoreImage}
                            style={{
                                height: 380,
                                width: 'auto',
                                flex: 1,
                                objectFit: 'contain'
                            }}
                        />
                    </View>
                </View>

                <View
                    style={{
                        marginVertical: 20
                    }}
                >
                    <Text
                        style={[{
                            fontSize: 12,
                        }, globalStyles.fontRegular]}
                    >
                        {infantData.description}
                    </Text>
                </View>

                {/* Infant Check In */}
                <View>
                    <Text
                        style={[{
                            fontSize: 20,

                        }, globalStyles.fontBold]}
                    >
                        Infant check-in
                    </Text>

                    <FlatList
                        keyExtractor={(item, index) => index.toString()}
                        data={infantData.checkinOptions}
                        renderItem={({ item }) => FLInfantCheckInOptions({ item, navigation })}
                        showsVerticalScrollIndicator={false}
                        scrollEnabled={false}
                        numColumns={2}
                        columnWrapperStyle={{
                            justifyContent: 'space-between',
                            gap: 10
                        }}
                    />
                </View>

            </View>
        </View>
    )
}

export default DashboardInfantTab