import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
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
            >
                <Image
                    source={require('../public/assets/images/care_manager.png')}
                    style={{
                        width: '100%',
                        height: 200,
                    }}
                    resizeMode="contain"
                />
            </View>
            <View
                style={{
                    backgroundColor: 'rgba(255, 250, 250, 1)',
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
                            backgroundColor: 'rgba(255, 250, 250, 0.90)',
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

                        <GradientButtonWithSlightRadius
                            title='Request a call now'
                            fullRounded={true}
                            fullWidth={true}
                            onPress={() => {
                                Toast.show({
                                    type: 'success',
                                    text1: 'Callback requested successfully!',
                                    text2: 'Callback requested successfully!',
                                    position: 'bottom',

                                });
                            }}
                        />
                    </View>
                </View>
            </View>
        </View>
    );
};

export default CareManagerCard;
