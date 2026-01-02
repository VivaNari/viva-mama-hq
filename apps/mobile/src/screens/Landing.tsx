import { View, Text, ScrollView, Image, TouchableOpacity, ActivityIndicator } from 'react-native'
import React, { useEffect, useState } from 'react'
import { globalStyles, landingStyles } from '../public/styles'
import { MaterialDesignIcons } from '@react-native-vector-icons/material-design-icons';
import { colors } from '../public/assets/colors';
import LinearGradient from 'react-native-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import Toast from 'react-native-toast-message';

const Landing = ({ navigation }: { navigation: { navigate: any } }) => {
    const { signInWithGoogle } = useAuth();
    const [getLoading, setLoading] = useState<boolean>(false);

    useEffect(() => {
    }, []);

    return (
        <SafeAreaView style={{
            flex: 1
        }}>
            <ScrollView style={{ flex: 1, paddingBottom: 20, paddingHorizontal: 20 }} contentContainerStyle={{ justifyContent: "space-between", flexGrow: 1 }}>
                {/* Logo */}
                <View style={{
                    alignItems: 'center',
                    paddingTop: 20
                }}>
                    <Image
                        source={require('../public/assets/images/viva_logo.png')}
                        style={{

                        }}
                    />
                </View>

                {/* Welcome Text */}
                <View>
                    <Text style={[landingStyles.welcomeText, globalStyles.fontBold]}>Welcome, Mama</Text>
                    <Text style={[landingStyles.welcomeCaption, globalStyles.fontRegular]}>Your complete companion for postpartum care and recovery.</Text>
                </View>

                {/* Login Options */}
                <View style={{ paddingTop: 90, gap: 10 }}>
                    <TouchableOpacity
                        style={{ flex: 1, backgroundColor: colors.purple, borderRadius: 40 }}
                        activeOpacity={0.8}
                        onPress={async () => {
                            try {
                                setLoading(true);
                                await signInWithGoogle();
                            } catch (e) {
                                console.error("Google sign-in cancelled or failed", e);
                                Toast.show({
                                    type: 'error',
                                    text1: 'Error',
                                    text2: "Google sign-in cancelled or failed!",
                                    position: 'top'
                                });
                            } finally {
                                setLoading(false);
                            }
                        }}
                        disabled={getLoading}

                    >
                        <View
                            style={{
                                height: "100%",
                                width: "100%",
                                borderRadius: 40,
                                justifyContent: "center",
                                alignItems: "center",
                                flexDirection: "row",
                                padding: 14,
                                gap: 20

                            }}
                        >
                            {
                                getLoading ?
                                    <ActivityIndicator size="small" color={colors.white} /> :
                                    <MaterialDesignIcons name="google" color={colors.white} size={20} />
                            }
                            <Text
                                style={[{
                                    color: colors.white,
                                    fontSize: 18
                                }, globalStyles.fontRegular]}
                            >
                                Continue with Google
                            </Text>
                        </View>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={{ flex: 1, borderRadius: 40, backgroundColor: colors.lightPurple, borderWidth: 1, borderColor: colors.darkPurple }}
                        activeOpacity={0.8}
                        onPress={() => {
                            navigation.navigate("LoginWithPhone")
                        }}
                    >
                        <View
                            style={{
                                height: "100%",
                                width: "100%",
                                borderRadius: 40,
                                justifyContent: "center",
                                alignItems: "center",
                                flexDirection: "row",
                                padding: 14,
                                gap: 20

                            }}
                        >
                            <MaterialDesignIcons name="phone" color={colors.purple} size={20} />
                            <Text
                                style={[{
                                    color: colors.purple,
                                    fontSize: 18
                                }, globalStyles.fontRegular]}
                            >
                                Continue with Phone
                            </Text>
                        </View>
                    </TouchableOpacity>
                    <View
                        style={{
                            marginTop: 10
                        }}
                    >
                        <Text
                            style={{
                                textAlign: 'center',
                                fontSize: 12,
                                color: colors.gray,
                                ...globalStyles.fontRegular
                            }}
                        >
                            Build Number: 065001012026
                        </Text>
                    </View>
                </View>
            </ScrollView>
        </SafeAreaView>
    )
}

export default Landing