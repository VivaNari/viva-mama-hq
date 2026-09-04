import { MaterialDesignIcons } from '@react-native-vector-icons/material-design-icons';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Image, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { useAuth } from '../context/AuthContext';
import { colors } from '../public/assets/colors';
import { globalStyles, landingStyles } from '../public/styles';

import { Linking, Modal } from 'react-native';
import { CURRENT_VERSIONS } from '../context/AuthContext';

const Landing = ({ navigation }: { navigation: { navigate: any } }) => {
    const { t } = useTranslation();
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
                text1: t('common.error'),
                text2: t('landing.googleSignInFailed'),
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
                                <Text style={[globalStyles.fontBold, { fontSize: 20, color: colors.darkPurple, flex: 1 }]}>{t('landing.disclaimerTitle')}</Text>
                                <TouchableOpacity onPress={() => setShowDisclaimerModal(false)}>
                                    <MaterialDesignIcons name="close" size={24} color={colors.black} />
                                </TouchableOpacity>
                            </View>

                            <Text style={[globalStyles.fontRegular, { fontSize: 14, color: colors.black }]}>
                                {t('landing.disclaimerBody1')}
                            </Text>
                            <Text style={[globalStyles.fontRegular, { fontSize: 14, color: colors.black }]}>
                                {t('landing.disclaimerBody2')}
                            </Text>
                            <Text style={[globalStyles.fontRegular, { fontSize: 14, color: colors.black }]}>
                                {t('landing.disclaimerBody3')}
                            </Text>

                            <TouchableOpacity
                                onPress={handleAcceptDisclaimer}
                                style={{ padding: 12, borderRadius: 30, backgroundColor: colors.darkPurple, marginTop: 10 }}
                            >
                                <Text style={[globalStyles.fontSemiBold, { textAlign: 'center', color: colors.white }]}>{t('landing.understand')}</Text>
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
                            <Text style={[globalStyles.fontBold, { fontSize: 20, textAlign: 'center', color: colors.darkPurple }]}>{t('landing.userAgreement')}</Text>
                            <Text style={[globalStyles.fontRegular, { fontSize: 14, textAlign: 'center', color: colors.black }]}>
                                {t('landing.consentIntro')}
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
                                        {t('auth.agreeTo')}
                                    </Text>
                                    <TouchableOpacity onPress={() => Linking.openURL(PRIVACY_POLICY_URL)}>
                                        <Text style={[globalStyles.fontSemiBold, { fontSize: 13, color: colors.darkPurple, textDecorationLine: 'underline' }]}>
                                            {t('auth.privacyPolicy')}
                                        </Text>
                                    </TouchableOpacity>
                                    <Text style={[globalStyles.fontRegular, { fontSize: 13, color: colors.black }]}>
                                        {t('auth.and')}
                                    </Text>
                                    <TouchableOpacity onPress={() => Linking.openURL(TERMS_OF_USE_URL)}>
                                        <Text style={[globalStyles.fontSemiBold, { fontSize: 13, color: colors.darkPurple, textDecorationLine: 'underline' }]}>
                                            {t('auth.termsOfUse')}
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
                                        {t('auth.ageConfirm')}
                                    </Text>
                                </View>
                            </View>

                            <View style={{ flexDirection: 'row', gap: 10 }}>
                                <TouchableOpacity
                                    onPress={() => setIsModalVisible(false)}
                                    style={{ flex: 1, padding: 12, borderRadius: 30, borderWidth: 1, borderColor: colors.gray }}
                                >
                                    <Text style={[globalStyles.fontSemiBold, { textAlign: 'center', color: colors.gray }]}>{t('common.cancel')}</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    onPress={handleGoogleLogin}
                                    disabled={!isConsentChecked || !isAgeConsentChecked || getLoading}
                                    style={{ flex: 1, padding: 12, borderRadius: 30, backgroundColor: (isConsentChecked && isAgeConsentChecked) ? colors.darkPurple : colors.gray }}
                                >
                                    <Text style={[globalStyles.fontSemiBold, { textAlign: 'center', color: colors.white }]}>{t('common.continue')}</Text>
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
                        resizeMode='contain'
                        style={{
                            width: 250,
                        }}
                    />
                </View>

                {/* Welcome Text */}
                <View>
                    <Text style={[landingStyles.welcomeText, globalStyles.fontBold]}>{t('landing.welcome')}</Text>
                    <Text style={[landingStyles.welcomeCaption, globalStyles.fontRegular]}>{t('landing.welcomeCaption')}</Text>
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
                                {t('landing.continueWithGoogle')}
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
                                {t('landing.continueWithPhone')}
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
                            Build Number: 093701092026
                        </Text>
                    </View>
                </View>
            </ScrollView>
        </SafeAreaView>
    )
}

export default Landing