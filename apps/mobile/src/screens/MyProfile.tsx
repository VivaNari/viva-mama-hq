import { View, Text, ImageBackground, StyleSheet, Image, TouchableOpacity } from 'react-native'
import React from 'react'
import { SafeAreaView } from 'react-native-safe-area-context'
import { globalStyles } from '../public/styles'
import { colors } from '../public/assets/colors'
import LinearGradient from 'react-native-linear-gradient'

const MyProfile = () => {
    return (
        <SafeAreaView style={[globalStyles.container]}>
            <View style={{
            }}>
                <LinearGradient
                    colors={[colors.primary, colors.secondary]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={{ padding: 1, borderRadius: 10 }}
                >
                    <View
                        style={{
                            backgroundColor: colors.white,
                            borderRadius: 10
                        }}
                    >
                        <ImageBackground
                            source={require("../public/assets/images/Wave.png")}
                            resizeMode="cover"
                            style={{
                                height: 180,
                                width: '100%',
                                justifyContent: "flex-end",

                            }}>
                            <View style={{
                                ...StyleSheet.absoluteFillObject,
                                backgroundColor: "rgba(244, 244, 244, 0.7)",
                                borderRadius: 10
                            }} />
                            <View
                                style={{
                                    padding: 10,
                                    flex: 1,
                                    flexDirection: 'row',
                                    justifyContent: 'flex-start',
                                    gap: 30,
                                    alignItems: 'center'
                                }}
                            >
                                <View>
                                    <Image
                                        source={require('../public/assets/images/doctors/Dr_Harsha_Tomar.png')}
                                        style={{
                                            height: 110,
                                            width: 110,
                                            borderRadius: 75,
                                            marginBottom: 10,
                                            borderWidth: 2,
                                            borderColor: colors.purple
                                        }}
                                    />
                                    <TouchableOpacity
                                        style={{
                                            backgroundColor: colors.primary,
                                            paddingVertical: 5,
                                            borderRadius: 15
                                        }}
                                    >
                                        <Text
                                            style={{
                                                color: colors.white,
                                                textAlign: 'center'
                                            }}
                                        >
                                            Viva Premium
                                        </Text>
                                    </TouchableOpacity>
                                </View>

                                <View>
                                    <Text
                                        style={{
                                            fontSize: 20,
                                            fontWeight: 'bold',
                                            marginBottom: 5
                                        }}
                                    >
                                        Harsha Tomar
                                    </Text>
                                    <Text
                                        style={{
                                            color: 'rgba(0, 0, 0, 0.6)',
                                            fontSize: 14,
                                            fontWeight: 500
                                        }}
                                    >
                                        harshatomar@gmail.com
                                    </Text>
                                    <Text
                                        style={{
                                            color: 'rgba(0, 0, 0, 0.6)',
                                            fontSize: 14,
                                            fontWeight: 500
                                        }}
                                    >
                                        Age - 29
                                    </Text>

                                    <TouchableOpacity
                                        style={{
                                            backgroundColor: colors.secondary,
                                            paddingVertical: 5,
                                            borderRadius: 15,
                                            marginTop: 10,
                                        }}
                                    >
                                        <Text style={{
                                            textAlign: "center",
                                            color: colors.white
                                        }}>
                                            Edit Profile
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </ImageBackground>
                    </View>
                </LinearGradient>
            </View>

            <View
                style={{
                    backgroundColor: colors.profileOptionsBG,
                    paddingVertical: 15,
                    paddingHorizontal: 20,
                    borderRadius: 10,
                    marginVertical: 20,
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                }}
            >
                <Text>
                    Add Your partner
                </Text>
                <TouchableOpacity
                    style={{
                        backgroundColor: colors.primary,
                        paddingVertical: 10,
                        paddingHorizontal: 20,
                        borderRadius: 15
                    }}
                >
                    <Text
                        style={{
                            color: colors.white,
                            textAlign: 'center'
                        }}
                    >
                        Link Your Partner
                    </Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    )
}

export default MyProfile