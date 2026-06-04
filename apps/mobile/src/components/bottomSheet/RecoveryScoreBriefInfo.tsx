import { View, Text } from 'react-native'
import React from 'react'
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
    return (
        <View>
            <Text
                style={[{
                    fontSize: 18,
                    textAlign: 'center'

                }, globalStyles.fontBold]}
            >
                About your Viva Recovery Score

            </Text>


            <Text
                style={[{
                    fontSize: 16,
                    textAlign: 'justify'


                }, globalStyles.fontRegular, { marginTop: 10 }]}
            >
                Significance: {significance}
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
                    Disclaimer: Your Viva Recovery Score reflects how you are feeling this week based on your self check-in responses. It is a personal wellness reflection tool, not a medical assessment.
                </Text>
                <Text style={[globalStyles.fontRegular, { fontSize: 10, color: colors.gray, marginTop: 5 }]}>
                    VivaMama is not a medical device. The Recovery Score does not diagnose, treat, cure, or prevent any medical condition. It does not replace advice from a qualified healthcare professional.
                </Text>
                <Text style={[globalStyles.fontRegular, { fontSize: 10, color: colors.gray, marginTop: 5 }]}>
                    Any suggestions you receive based on your check-in are educational and general in nature, not personalised medical advice.
                </Text>
                <Text style={[globalStyles.fontRegular, { fontSize: 10, color: colors.gray, marginTop: 5 }]}>
                    If you have any health concern, please speak with your doctor or a qualified healthcare professional. In an emergency, contact emergency services immediately.
                </Text>
            </View>

            <View
                style={{
                    marginTop: 20

                }}
            >
                <GradientButtonWithSlightRadius
                    title='Learn More'
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