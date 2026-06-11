import { MaterialDesignIcons } from '@react-native-vector-icons/material-design-icons';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { useAuth } from '../context/AuthContext';
import { colors } from '../public/assets/colors';
import { globalStyles, landingStyles } from '../public/styles';

import { CURRENT_VERSIONS } from '../context/AuthContext';
import { Modal, Linking } from 'react-native';

const Landing = ({ navigation }: { navigation: { navigate: any } }) => {
    const { signInWithGoogle } = useAuth();
    const [getLoading, setLoading] = useState<boolean>(false);
    const [isModalVisible, setIsModalVisible] = useState<boolean>(false);
    const [isConsentChecked, setIsConsentChecked] = useState<boolean>(false);
    const [isAgeConsentChecked, setIsAgeConsentChecked] = useState<boolean>(false);
    const [showDisclaimerModal, setShowDisclaimerModal] = useState<boolean>(false);
    const [selectedLoginMethod, setSelectedLoginMethod] = useState<'google' | 'phone' | null>(null);

    const PRIVACY_POLICY_URL = 'https://vivamama.in/privacy-policy/';
    const TERMS_OF_USE_URL = 'https://vivamama.in/terms-and-conditions/';

    const handleGoogleLogin = async () => {
        try {
            setLoading(true);
            setIsModalVisible(false);
            const consents = [
                { type: 'privacy_policy', version: CURRENT_VERSIONS.PRIVACY_POLICY },
                { type: 'terms_of_use', version: CURRENT_VERSIONS.TERMS_OF_USE }
            ];
            await signInWithGoogle(consents);
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
    };

    const proceedWithLogin = (method: 'google' | 'phone') => {
        if (method === 'google') {
            setIsModalVisible(true);
        } else {
            navigation.navigate("LoginWithPhone");
        }
    };

    const handleLoginClick = (method: 'google' | 'phone') => {
        setSelectedLoginMethod(method);
        setShowDisclaimerModal(true);
    };

    const handleAcceptDisclaimer = () => {
        setShowDisclaimerModal(false);
        if (selectedLoginMethod) {
            proceedWithLogin(selectedLoginMethod);
        }
    };

    return (
        <SafeAreaView style={{
            flex: 1
        }}>
            <ScrollView style={{ flex: 1, paddingBottom: 20, paddingHorizontal: 20 }} contentContainerStyle={{ justifyContent: "space-between", flexGrow: 1 }}>
                {/* Disclaimer Modal */}
                <Modal
                    visible={showDisclaimerModal}
                    transparent={true}
                    animationType="fade"
                >
                    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)' }}>
                        <View style={{ width: '85%', backgroundColor: 'white', borderRadius: 20, padding: 20, gap: 15 }}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Text style={[globalStyles.fontBold, { fontSize: 20, color: colors.darkPurple, flex: 1 }]}>Before You Begin</Text>
                                <TouchableOpacity onPress={() => setShowDisclaimerModal(false)}>
                                    <MaterialDesignIcons name="close" size={24} color={colors.black} />
                                </TouchableOpacity>
                            </View>

                            <Text style={[globalStyles.fontRegular, { fontSize: 14, color: colors.black }]}>
                                VivaMama is a postpartum wellness and education companion. It is not a medical device and does not diagnose, treat, cure, or prevent any medical condition.
                            </Text>
                            <Text style={[globalStyles.fontRegular, { fontSize: 14, color: colors.black }]}>
                                Always consult a qualified healthcare professional for medical advice, diagnosis, or treatment.
                            </Text>
                            <Text style={[globalStyles.fontRegular, { fontSize: 14, color: colors.black }]}>
                                In an emergency, contact your doctor or local emergency services immediately.
                            </Text>

                            <TouchableOpacity
                                onPress={handleAcceptDisclaimer}
                                style={{ padding: 12, borderRadius: 30, backgroundColor: colors.darkPurple, marginTop: 10 }}
                            >
                                <Text style={[globalStyles.fontSemiBold, { textAlign: 'center', color: colors.white }]}>I Understand</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </Modal>

                {/* Consent Modal */}
                <Modal
                    visible={isModalVisible}
                    transparent={true}
                    animationType="fade"
                >
                    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)' }}>
                        <View style={{ width: '85%', backgroundColor: 'white', borderRadius: 20, padding: 20, gap: 20 }}>
                            <Text style={[globalStyles.fontBold, { fontSize: 20, textAlign: 'center', color: colors.darkPurple }]}>User Agreement</Text>
                            <Text style={[globalStyles.fontRegular, { fontSize: 14, textAlign: 'center', color: colors.black }]}>
                                Please review and agree to our terms before continuing with Google.
                            </Text>

                            <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 5 }}>
                                <TouchableOpacity
                                    onPress={() => setIsConsentChecked(!isConsentChecked)}
                                    style={{ marginRight: 10 }}
                                >
                                    <MaterialDesignIcons
                                        name={isConsentChecked ? "checkbox-marked" : "checkbox-blank-outline"}
                                        size={24}
                                        color={colors.darkPurple}
                                    />
                                </TouchableOpacity>
                                <View style={{ flex: 1, flexDirection: 'row', flexWrap: 'wrap' }}>
                                    <Text style={[globalStyles.fontRegular, { fontSize: 13, color: colors.black }]}>
                                        I agree to the{' '}
                                    </Text>
                                    <TouchableOpacity onPress={() => Linking.openURL(PRIVACY_POLICY_URL)}>
                                        <Text style={[globalStyles.fontSemiBold, { fontSize: 13, color: colors.darkPurple, textDecorationLine: 'underline' }]}>
                                            Privacy Policy
                                        </Text>
                                    </TouchableOpacity>
                                    <Text style={[globalStyles.fontRegular, { fontSize: 13, color: colors.black }]}>
                                        {' '}and{' '}
                                    </Text>
                                    <TouchableOpacity onPress={() => Linking.openURL(TERMS_OF_USE_URL)}>
                                        <Text style={[globalStyles.fontSemiBold, { fontSize: 13, color: colors.darkPurple, textDecorationLine: 'underline' }]}>
                                            Terms of Use
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                            </View>

                            <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 5 }}>
                                <TouchableOpacity
                                    onPress={() => setIsAgeConsentChecked(!isAgeConsentChecked)}
                                    style={{ marginRight: 10 }}
                                >
                                    <MaterialDesignIcons
                                        name={isAgeConsentChecked ? "checkbox-marked" : "checkbox-blank-outline"}
                                        size={24}
                                        color={colors.darkPurple}
                                    />
                                </TouchableOpacity>
                                <View style={{ flex: 1, flexDirection: 'row', flexWrap: 'wrap' }}>
                                    <Text style={[globalStyles.fontRegular, { fontSize: 13, color: colors.black }]}>
                                        I confirm that I am 18 years of age or older.
                                    </Text>
                                </View>
                            </View>

                            <View style={{ flexDirection: 'row', gap: 10 }}>
                                <TouchableOpacity
                                    onPress={() => setIsModalVisible(false)}
                                    style={{ flex: 1, padding: 12, borderRadius: 30, borderWidth: 1, borderColor: colors.gray }}
                                >
                                    <Text style={[globalStyles.fontSemiBold, { textAlign: 'center', color: colors.gray }]}>Cancel</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    onPress={handleGoogleLogin}
                                    disabled={!isConsentChecked || !isAgeConsentChecked || getLoading}
                                    style={{ flex: 1, padding: 12, borderRadius: 30, backgroundColor: (isConsentChecked && isAgeConsentChecked) ? colors.darkPurple : colors.gray }}
                                >
                                    <Text style={[globalStyles.fontSemiBold, { textAlign: 'center', color: colors.white }]}>Continue</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </Modal>
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
                        style={{ flex: 1, backgroundColor: colors.darkPurple, borderRadius: 40 }}
                        activeOpacity={0.8}
                        onPress={() => handleLoginClick('google')}
                        disabled={getLoading}

                    >
                        <View
                            style={{
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
                                }, globalStyles.fontSemiBold]}
                            >
                                Continue with Google
                            </Text>
                        </View>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={{ flex: 1, borderRadius: 40, borderWidth: 1.5, backgroundColor: colors.lightPurple, borderColor: colors.darkPurple }}
                        activeOpacity={0.8}
                        onPress={() => handleLoginClick('phone')}
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
                                    color: colors.darkPurple,
                                    fontSize: 18
                                }, globalStyles.fontSemiBold]}
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
                            Build Number: 014718012026
                        </Text>
                    </View>
                </View>
            </ScrollView>
        </SafeAreaView>
    )
}

export default Landing