import { View, Text, ScrollView, Image, TouchableOpacity } from 'react-native'
import React from 'react'
import { globalStyles, landingStyles } from '../public/styles'
import { MaterialDesignIcons } from '@react-native-vector-icons/material-design-icons';
import { colors } from '../public/assets/colors';
import LinearGradient from 'react-native-linear-gradient';

const Landing = ({ navigation }: { navigation: { navigate: any } }) => {
    return (
        <ScrollView style={{
        }}>
            {/* pattern */}
            <View style={{

            }}>
                <Image
                    source={require('../public/assets/images/Landing.png')}
                    style={{ width: '100%', objectFit: 'cover' }}
                />
            </View>

            <View style={globalStyles.container}>

                {/* Logo */}
                <View style={{
                    transform: 'translateY(-50%)',
                    alignItems: 'center',
                }}>
                    <Image
                        source={require('../public/assets/images/viva_logo.png')}
                        style={{

                        }}
                    />
                </View>

                {/* Welcome Text */}
                <View>
                    <Text style={landingStyles.welcomeText}>Welcome, Mama</Text>
                    <Text style={landingStyles.welcomeCaption}>Your complete companion for postpartum care and recovery.</Text>
                </View>

                {/* Login Options */}
                <View style={{ paddingTop: 90, gap: 10 }}>
                    <TouchableOpacity
                        style={{ flex: 1 }}
                        activeOpacity={0.8}
                    >
                        <LinearGradient
                            colors={[colors.primary, colors.secondary]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={{
                                height: "100%",
                                width: "100%",
                                borderRadius: 40,
                                justifyContent: "center",
                                alignItems: "center",
                                flexDirection: "row",
                                padding: 14,
                                gap: 10

                            }}
                        >
                            <MaterialDesignIcons name="google" color={colors.white} size={20} />
                            <Text style={{ color: colors.white, fontSize: 20 }}>Continue with Google</Text>
                        </LinearGradient>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={{ flex: 1 }}
                        activeOpacity={0.8}
                        onPress={() => navigation.navigate("LoginWithPhone")}
                    >
                        <LinearGradient
                            colors={[colors.primary, colors.secondary]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={{
                                height: "100%",
                                width: "100%",
                                borderRadius: 40,
                                justifyContent: "center",
                                alignItems: "center",
                                flexDirection: "row",
                                padding: 14,
                                gap: 10

                            }}
                        >
                            <MaterialDesignIcons name="phone" color={colors.white} size={20} />
                            <Text style={{ color: colors.white, fontSize: 20 }}>Continue with Phone</Text>
                        </LinearGradient>
                    </TouchableOpacity>
                </View>
            </View>


        </ScrollView>
    )
}

export default Landing