import { useNavigation } from '@react-navigation/native';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Text, TouchableOpacity, View } from 'react-native';
import { colors } from '../public/assets/colors';
import { globalStyles } from '../public/styles';
import { IUser } from '../types/user.types';

const NPWomanBabyArriving = ({ userData }: {
    userData: IUser
}) => {
    const { t } = useTranslation();
    const navigation = useNavigation<any>();
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
                            {t('dashboard.npTitle')}
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
                                {' '}{t('dashboard.weeks')}
                            </Text>
                        </Text>
                    </View>

                    <View style={{ marginTop: 20 }}>
                        <View

                        >

                            <Text style={[globalStyles.fontSemiBold, {fontSize: 16, color: colors.darkGray, textAlign: 'center' }]}>
                                {t('dashboard.npBody')}
                            </Text>
                        </View>
                    </View>


                </View>
                {/* Once the baby arrives she updates the date and outcome here, which is
                    what moves her out of the NP (still pregnant) state. */}
                <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => navigation.navigate('EditProfile')}
                    style={{
                        alignItems: 'center',
                        paddingVertical: 10,
                        // Horizontal padding rather than a fixed width: the label is far
                        // longer than "Learn More" and grows again in Hindi.
                        paddingHorizontal: 20,
                        backgroundColor: colors.purple,
                        justifyContent: "center",
                        alignSelf: "center",
                        borderRadius: 20,
                        marginTop: 20
                    }}
                >
                    <Text
                        style={[
                            globalStyles.fontSemiBold,
                            { color: colors.white, textAlign: 'center' },
                        ]}
                    >
                        {t('dashboard.updateDeliveryStatus')}
                    </Text>
                </TouchableOpacity>
            </View>

        </View>
    );
};

export default NPWomanBabyArriving;
