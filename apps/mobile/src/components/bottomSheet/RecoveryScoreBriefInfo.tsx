import { View, Text } from 'react-native'
import React from 'react'
import { globalStyles } from '../../public/styles'
import GradientButtonWithSlightRadius from '../GradientButtonWithSlightRadius'

const RecoveryScoreBriefInfo = ({
    significance,
    briefInfo,
    navigation
}: {
    significance: string
    briefInfo: string
    navigation: any
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

            <View
                style={{
                    marginTop: 20

                }}
            >
                <GradientButtonWithSlightRadius
                    title='Learn More'
                    fullRounded={true}
                    onPress={() => { navigation.navigate('AboutRecoveryScore' as never) }}
                />
            </View>
        </View>
    )
}

export default RecoveryScoreBriefInfo