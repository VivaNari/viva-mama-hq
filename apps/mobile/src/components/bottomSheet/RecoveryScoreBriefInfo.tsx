import { View, Text } from 'react-native'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { globalStyles } from '../../public/styles'
import GradientButtonWithSlightRadius from '../GradientButtonWithSlightRadius'
import { colors } from '../../public/assets/colors'

const RecoveryScoreBriefInfo = ({
    significance,
    briefInfo,
    navigation,
    onClose
}: {
    significance: string
    briefInfo: string
    navigation: any
    onClose?: () => void
}) => {
    const { t } = useTranslation();
    return (
        <View>
            <Text
                style={[{
                    fontSize: 18,
                    textAlign: 'center'

                }, globalStyles.fontBold]}
            >
                {t('vivaScore.aboutTitle')}

            </Text>


            <Text
                style={[{
                    fontSize: 16,
                    textAlign: 'justify'


                }, globalStyles.fontRegular, { marginTop: 10 }]}
            >
                {t('vivaScore.significanceLabel')}{significance}
            </Text>
            <Text
                style={[{
                    fontSize: 16,
                    textAlign: 'justify'


                }, globalStyles.fontRegular, { marginTop: 10 }]}
            >
                {briefInfo}
            </Text>

            <View style={{ marginTop: 20 }}>
                <Text style={[globalStyles.fontRegular, { fontSize: 10, color: colors.gray }]}>
                    {t('vivaScore.disclaimer1')}
                </Text>
                <Text style={[globalStyles.fontRegular, { fontSize: 10, color: colors.gray, marginTop: 5 }]}>
                    {t('vivaScore.disclaimer2')}
                </Text>
                <Text style={[globalStyles.fontRegular, { fontSize: 10, color: colors.gray, marginTop: 5 }]}>
                    {t('vivaScore.disclaimer3')}
                </Text>
                <Text style={[globalStyles.fontRegular, { fontSize: 10, color: colors.gray, marginTop: 5 }]}>
                    {t('vivaScore.disclaimer4')}
                </Text>
            </View>

            <View
                style={{
                    marginTop: 20

                }}
            >
                <GradientButtonWithSlightRadius
                    title={t('common.learnMore')}
                    fullRounded={true}
                    onPress={() => {
                        if (onClose) onClose();
                        navigation.navigate('AboutRecoveryScore' as never)
                    }}
                />
            </View>
        </View>
    )
}

export default RecoveryScoreBriefInfo