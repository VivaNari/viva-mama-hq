import {
    View,
    ScrollView,
    Image,
    Text,
    TouchableOpacity,
    TextInput,
    ActivityIndicator,
} from 'react-native';
import React, { useEffect, useState } from 'react';
import { OtpInput } from 'react-native-otp-entry';
import { globalStyles } from '../public/styles';
import LinearGradient from 'react-native-linear-gradient';
import { colors } from '../public/assets/colors';
import MaterialDesignIcons from '@react-native-vector-icons/material-design-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { IRequestOtpResponse } from '../types/auth.types';

const LoginwithPhone = () => {
    const [isSentOtp, setIsSentOtp] = useState(false);
    const [phoneNumber, setPhoneNumber] = useState<string>('');
    const [otp, setOTP] = useState<string>('');
    const [verificationKey, setVerificationKey] = useState<string>('');
    const [getLoading, setLoading] = useState<boolean>(false);
    const { requestPhoneOTP, verifyPhoneOTP } = useAuth();
    useEffect(() => {
        console.log('🔥 BEFORE FETCH');
    }, []);
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
                                    selectionColor={colors.primary}
                                    placeholderTextColor={colors.black}
                                    placeholder={'Enter Phone Number'}
                                    style={[globalStyles.input, globalStyles.fontRegular, { backgroundColor: colors.lightGray, borderWidth: 1, borderColor: colors.darkPurple, fontSize: 18, color: colors.purple }]}
                                    onChangeText={setPhoneNumber}
                                    value={phoneNumber}
                                />
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
                                    style={{ flex: 1, marginTop: 30, backgroundColor: colors.lightPurple, borderRadius: 40, borderWidth: 1, borderColor: colors.darkPurple }}
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
                                                    color={colors.purple}
                                                    size={20}
                                                />
                                        }
                                        <Text
                                            style={[{
                                                color: colors.purple,
                                                fontSize: 18,
                                            }, globalStyles.fontRegular]}
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
                                    focusColor={colors.secondary}
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
                                        await verifyPhoneOTP(phoneNumber, otp, verificationKey);
                                        setLoading(false);
                                    }}
                                    style={{ flex: 1, marginTop: 30, backgroundColor: colors.lightPurple, borderRadius: 40, borderWidth: 1, borderColor: colors.darkPurple }}
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
                                                color: colors.purple,
                                                fontSize: 18,
                                            }, globalStyles.fontRegular]}
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
