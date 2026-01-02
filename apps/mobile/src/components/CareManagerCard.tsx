import React from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Toast from 'react-native-toast-message';
import { colors } from '../public/assets/colors';
import { globalStyles } from '../public/styles';
import GradientButtonWithSlightRadius from './GradientButtonWithSlightRadius';

const CareManagerCard = () => {
    return (
        <View
            style={{
                marginVertical: 10,
            }}
        >
            <View
                style={{
                    backgroundColor: colors.white,
                    padding: 10,
                    borderRadius: 10,
                    overflow: 'hidden',
                    boxShadow: '0 0 4px 0 rgba(0, 0, 0, 0.25)',
                    paddingBottom: 20
                }}
            >
                <View>
                    <View
                        style={{
                            ...StyleSheet.absoluteFillObject,
                            backgroundColor: colors.white,
                        }}
                    />
                    <View
                        style={{
                            paddingTop: 20,
                            alignItems: 'center'
                        }}
                    >
                        <Text
                            style={[{
                                fontSize: 16,
                                textAlign: 'center'

                            }, globalStyles.fontBold]}
                        >
                            Hey Mama! I am your care manager!
                        </Text>
                    </View>

                    <View style={{ marginTop: 20 }}>
                        <View

                        >

                            <Text style={[globalStyles.fontRegular, { color: colors.darkGray, textAlign: 'center' }]}>
                                Hey mama! I’m your dedicated care manager—whenever you’re feeling low, overwhelmed, or need support, you can request a call anytime. I’m here to help.
                            </Text>
                        </View>
                    </View>

                    <View
                    >

                        <TouchableOpacity
                            style={{ backgroundColor: colors.purple, padding: 10, borderRadius: 40, marginTop: 20, width: 180, alignContent: "center", alignSelf: "center" }}
                            onPress={() => {
                                Toast.show({
                                    type: 'success',
                                    text1: 'Callback requested successfully!',
                                    text2: 'Callback requested successfully!',
                                    position: 'bottom',

                                });
                            }}
                        >
                            <Text style={{ textAlign: "center", color: colors.white, ...globalStyles.fontSemiBold }}>Request a Call back</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </View>
    );
};

export default CareManagerCard;
