import {
    View,
    ScrollView,
    Image,
    Text,
    TouchableOpacity,
    TextInput,
} from 'react-native';
import React, { useState } from 'react';
import { OtpInput } from 'react-native-otp-entry';
import { globalStyles, landingStyles } from '../public/styles';
import LinearGradient from 'react-native-linear-gradient';
import { colors } from '../public/assets/colors';
import MaterialDesignIcons from '@react-native-vector-icons/material-design-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

const LoginwithPhone = ({ navigation }: { navigation: { navigate: any } }) => {
    const [isSentOtp, setIsSentOtp] = useState(false);
    return (
        <SafeAreaView>
            <ScrollView>
                <View style={globalStyles.container}>
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
                                    placeholderTextColor={colors.white}
                                    placeholder={'Enter Phone Number'}
                                    style={[globalStyles.input, globalStyles.fontRegular]}
                                />
                                <TouchableOpacity
                                    onPress={() => setIsSentOtp(true)}
                                    style={{ flex: 1, marginTop: 30 }}
                                    activeOpacity={0.8}
                                >
                                    <LinearGradient
                                        colors={[colors.primary, colors.secondary]}
                                        start={{ x: 0, y: 0 }}
                                        end={{ x: 1, y: 0 }}
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
                                        <MaterialDesignIcons
                                            name="phone-settings"
                                            color={colors.white}
                                            size={20}
                                        />
                                        <Text
                                            style={[{
                                                color: colors.white,
                                                fontSize: 18,
                                            }, globalStyles.fontRegular]}
                                        >
                                            Send OTP
                                        </Text>
                                    </LinearGradient>
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
                                    onTextChange={text => console.log(text)}
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
                                    onPress={() => navigation.navigate('Onboarding')}
                                    style={{ flex: 1, marginTop: 30 }}
                                    activeOpacity={0.8}
                                >
                                    <LinearGradient
                                        colors={[colors.primary, colors.secondary]}
                                        start={{ x: 0, y: 0 }}
                                        end={{ x: 1, y: 0 }}
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
                                        <Text
                                            style={[{
                                                color: colors.white,
                                                fontSize: 18,
                                            }, globalStyles.fontRegular]}
                                        >
                                            Submit
                                        </Text>
                                    </LinearGradient>
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
};

export default LoginwithPhone;
