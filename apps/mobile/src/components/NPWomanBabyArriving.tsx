import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { colors } from '../public/assets/colors';
import { globalStyles } from '../public/styles';
import GradientButtonWithSlightRadius from './GradientButtonWithSlightRadius';
import { useNavigation } from '@react-navigation/native';
import { IUser } from '../types/user.types';

const NPWomanBabyArriving = ({ userData }: {
    userData: IUser
}) => {
    const navigation = useNavigation();
    return (
        <View
            style={{
                marginBottom: 10,
            }}
        >
            <View
            >
                <Image
                    source={require('../public/assets/images/baby_holding_card.png')}
                    style={{
                        width: '100%',
                        height: 120,
                        transform: 'translateY(12%)',
                        zIndex: 2
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
                            Hey Mama! I am coming in
                        </Text>

                        <Text
                            style={[{
                                fontSize: 30,
                                backgroundColor: colors.greenBadgeBG,
                                color: colors.greenBadgeText,
                                paddingVertical: 4,
                                paddingHorizontal: 17,
                                borderRadius: 100,
                                textAlign: 'center',
                                marginTop: 6,

                            }, globalStyles.fontRegular]}
                        >
                            {40 - (userData.current_weekdays.weeks!) as number}
                            <Text
                                style={{
                                    fontSize: 13
                                }}
                            >
                                {' '}weeks
                            </Text>
                        </Text>
                    </View>

                    <View style={{ marginTop: 20 }}>
                        <View

                        >

                            <Text style={[globalStyles.fontRegular, { color: colors.darkGray, textAlign: 'center' }]}>
                                After delivery, VivaMama tracks your recovery.
                                Your physical, emotional, and lactation health
                                are monitored across each postpartum week
                                to support a safe and steady recovery.
                            </Text>
                        </View>
                    </View>

                    <View
                        style={{
                            alignItems: 'center',
                            paddingTop: 20
                        }}
                    >

                        <GradientButtonWithSlightRadius
                            title='Learn More'
                            fullRounded={true}
                            fullWidth={false}
                            onPress={() => { navigation.navigate('AboutRecoveryScore' as never) }}
                        />
                    </View>
                </View>
            </View>
        </View>
    );
};

export default NPWomanBabyArriving;
