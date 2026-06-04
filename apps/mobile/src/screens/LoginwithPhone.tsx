import {
    View,
    ScrollView,
    Image,
    Text,
    TouchableOpacity,
    TextInput,
    ActivityIndicator,
    Linking,
} from 'react-native';
import React, { useEffect, useState } from 'react';
import { OtpInput } from 'react-native-otp-entry';
import { globalStyles } from '../public/styles';
import LinearGradient from 'react-native-linear-gradient';
import { colors } from '../public/assets/colors';
import MaterialDesignIcons from '@react-native-vector-icons/material-design-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useAuth, CURRENT_VERSIONS } from '../context/AuthContext';
import { IRequestOtpResponse } from '../types/auth.types';

const LoginwithPhone = () => {
    const navigation = useNavigation<any>();
    const [isSentOtp, setIsSentOtp] = useState(false);
    const [phoneNumber, setPhoneNumber] = useState<string>('');
    const [otp, setOTP] = useState<string>('');
    const [verificationKey, setVerificationKey] = useState<string>('');
    const [getLoading, setLoading] = useState<boolean>(false);
    const [isConsentChecked, setIsConsentChecked] = useState<boolean>(false);
    const [isAgeConsentChecked, setIsAgeConsentChecked] = useState<boolean>(false);
    const { requestPhoneOTP, verifyPhoneOTP } = useAuth();

    const PRIVACY_POLICY_URL = 'https://vivamama.in/privacy-policy/';
    const TERMS_OF_USE_URL = 'https://vivamama.in/terms-and-conditions/';

    const handlePhoneChange = (text: string) => {
        const cleaned = text.replace(/[^0-9]/g, '');
        if (cleaned.length <= 10) {
            setPhoneNumber(cleaned);
        }
    };

    const isPhoneValid = phoneNumber.length === 10;

    return (
        <SafeAreaView style={{ flex: 1 }}>
            <ScrollView style={{ backgroundColor: "white" }}>
                <View style={[globalStyles.container, { backgroundColor: colors.white }]}>
                    {/* Logo */}
                    <View
                        style={{
                            alignItems: 'center',
                        }}
                    >
                        <Image
                            source={require('../public/assets/images/viva_logo.png')}
                            style={{}}
                        />
                    </View>

                    {/* Login Options */}
                    <View style={{ paddingTop: 90, gap: 10 }}>
                        {!isSentOtp ? (
                            <View>
                                <TextInput
                                    inputMode="tel"
                                    keyboardType="phone-pad"
                                    maxLength={10}
                                    selectionColor={colors.darkPurple}
                                    placeholderTextColor={colors.black}
                                    placeholder={'Enter Phone Number'}
                                    style={[globalStyles.input, globalStyles.fontSemiBold, { backgroundColor: colors.lightGray, borderWidth: 1, borderColor: colors.darkPurple, color: colors.purple }]}
                                    onChangeText={handlePhoneChange}
                                    value={phoneNumber}
                                />

                                {/* Consent Checkbox */}
                                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 20, paddingHorizontal: 5 }}>
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

                                {/* Age Consent Checkbox */}
                                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10, paddingHorizontal: 5 }}>
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
                                    <View style={{ flex: 1 }}>
                                        <Text style={[globalStyles.fontRegular, { fontSize: 13, color: colors.black }]}>
                                            I confirm that I am 18 years of age or older.
                                        </Text>
                                    </View>
                                </View>

                                <TouchableOpacity
                                    onPress={async () => {
                                        try {

                                            setLoading(true);
                                            const { success, verification_key } = await requestPhoneOTP(phoneNumber) as IRequestOtpResponse;
                                            if (success) {
                                                setIsSentOtp(true);
                                                setVerificationKey(verification_key as string);
                                            }
                                            setLoading(false);
                                        } catch (error: any) {

                                            setLoading(false);
                                        }
                                    }}
                                    style={{
                                        flex: 1,
                                        marginTop: 30,
                                        backgroundColor: (isPhoneValid && isConsentChecked && isAgeConsentChecked) ? colors.darkPurple : colors.gray,
                                        borderRadius: 40
                                    }}
                                    activeOpacity={0.8}
                                    disabled={getLoading || !isPhoneValid || !isConsentChecked || !isAgeConsentChecked}
                                >
                                    <View

                                        style={{
                                            height: '100%',
                                            width: '100%',
                                            borderRadius: 40,
                                            justifyContent: 'center',
                                            alignItems: 'center',
                                            flexDirection: 'row',
                                            padding: 14,
                                            gap: 20,

                                        }}
                                    >
                                        {
                                            getLoading ?
                                                <ActivityIndicator
                                                    color={colors.success}
                                                /> :
                                                <MaterialDesignIcons
                                                    name="phone-settings"
                                                    color={colors.white}
                                                    size={20}
                                                />
                                        }
                                        <Text
                                            style={[{
                                                color: colors.white,
                                                fontSize: 18,
                                            }, globalStyles.fontSemiBold]}
                                        >

                                            Send OTP
                                        </Text>
                                    </View>
                                </TouchableOpacity>
                            </View>
                        ) : (
                            <View>
                                <OtpInput
                                    theme={{
                                        placeholderTextStyle: globalStyles.fontRegular,
                                        pinCodeTextStyle: globalStyles.fontRegular
                                    }}
                                    numberOfDigits={6}
                                    focusColor={colors.purple}
                                    autoFocus={false}
                                    hideStick={true}
                                    placeholder="******"
                                    blurOnFilled={true}
                                    disabled={false}
                                    type="numeric"
                                    secureTextEntry={false}
                                    focusStickBlinkingDuration={500}
                                    onFocus={() => console.log('Focused')}
                                    onBlur={() => console.log('Blurred')}
                                    onTextChange={text => setOTP(text)}
                                    onFilled={text => console.log(`OTP is ${text}`)}
                                    textInputProps={{
                                        accessibilityLabel: 'One-Time Password',
                                    }}
                                    textProps={{
                                        accessibilityRole: 'text',
                                        accessibilityLabel: 'OTP digit',
                                        allowFontScaling: false,
                                    }}

                                />
                                <TouchableOpacity
                                    onPress={async () => {
                                        setLoading(true);
                                        const consents = [
                                            { type: 'privacy_policy', version: CURRENT_VERSIONS.PRIVACY_POLICY },
                                            { type: 'terms_of_use', version: CURRENT_VERSIONS.TERMS_OF_USE }
                                        ];
                                        await verifyPhoneOTP(phoneNumber, otp, verificationKey, consents);
                                        setLoading(false);
                                    }}
                                    style={{ flex: 1, marginTop: 30, backgroundColor: colors.darkPurple, borderRadius: 40, borderWidth: 1, borderColor: colors.darkPurple }}
                                    activeOpacity={0.8}
                                    disabled={getLoading}
                                >
                                    <View
                                        style={{
                                            height: '100%',
                                            width: '100%',
                                            borderRadius: 40,
                                            justifyContent: 'center',
                                            alignItems: 'center',
                                            flexDirection: 'row',
                                            padding: 14,
                                            gap: 10,

                                        }}
                                    >
                                        {
                                            getLoading &&
                                            <ActivityIndicator
                                                color={colors.success}
                                            />
                                        }
                                        <Text
                                            style={[{
                                                color: colors.white,
                                                fontSize: 18
                                            }, globalStyles.fontSemiBold]}
                                        >
                                            Submit
                                        </Text>
                                    </View>
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>
                </View>
            </ScrollView>
        </SafeAreaView >
    );
};

export default LoginwithPhone;
