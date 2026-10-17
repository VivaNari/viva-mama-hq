import React from 'react';
import { Text, ScrollView, Image, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { globalStyles } from '../public/styles';
import { colors } from '../public/assets/colors';

const AboutVivaAI = () => {
    const { t } = useTranslation();

    return (
        <SafeAreaView style={[globalStyles.container, { flex: 1, backgroundColor: colors.white }]} edges={['bottom', 'left', 'right']}>

            <ScrollView style={{ flex: 1 }}>
                <View
                    style={{
                        justifyContent: 'center',
                        alignItems: 'center',
                    }}
                >
                    <Image
                        source={require('../public/assets/images/avatar_mom.png')}
                        alt="Viva AI"
                        resizeMode='contain'
                        style={{
                            width: 150,
                            height: 150,
                            margin: 2
                        }}
                    />
                </View>
                <View >
                    <Text style={[globalStyles.fontSemiBold, { fontSize: 18, color: colors.darkPurple, marginBottom: 12 }]}>
                        {t('aboutVivaAI.title')}
                    </Text>
                    <Text style={[globalStyles.fontRegular, { fontSize: 15, color: colors.black, marginBottom: 16, lineHeight: 22 }]}>
                        {t('aboutVivaAI.paragraph1')}
                    </Text>
                    <Text style={[globalStyles.fontRegular, { fontSize: 15, color: colors.black, marginBottom: 16, lineHeight: 22 }]}>
                        {t('aboutVivaAI.paragraph2')}
                    </Text>
                    <Text style={[globalStyles.fontRegular, { fontSize: 15, color: colors.black, marginBottom: 24, lineHeight: 22 }]}>
                        {t('aboutVivaAI.paragraph3')}
                    </Text>

                    <Text style={[globalStyles.fontSemiBold, { fontSize: 18, color: colors.darkPurple, marginBottom: 12 }]}>
                        {t('aboutVivaAI.whatYouCanAsk')}
                    </Text>
                    <Text style={[globalStyles.fontRegular, { fontSize: 15, color: colors.black, marginBottom: 32, lineHeight: 22 }]}>
                        {t('aboutVivaAI.whatYouCanAskDesc')}
                    </Text>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
};

export default AboutVivaAI;
