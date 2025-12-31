import React from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
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
                            Hey Mama! Your baby is coming in
                        </Text>

                        <Text
                            style={[{
                                fontSize: 16,
                                backgroundColor: colors.greenBadgeBG,
                                color: colors.greenBadgeText,
                                paddingVertical: 4,
                                paddingHorizontal: 17,
                                borderRadius: 100,
                                textAlign: 'center',
                                marginTop: 6,

                            }, globalStyles.fontRegular]}
                        >
                            {userData.np_weeks}
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


                </View>
                <TouchableOpacity
                    style={{
                        alignItems: 'center',
                        padding: 10,
                        ...globalStyles.fontSemiBold,
                        backgroundColor: colors.purple,
                        width: 120,
                        justifyContent: "center",
                        alignContent: "center",
                        alignSelf: "center",
                        borderRadius: 20,
                        marginTop: 20
                    }}
                >

                    <Text style={{ color: colors.white, ...globalStyles.fontSemiBold }}>Learn More</Text>
                </TouchableOpacity>
            </View>

        </View>
    );
};

export default NPWomanBabyArriving;
