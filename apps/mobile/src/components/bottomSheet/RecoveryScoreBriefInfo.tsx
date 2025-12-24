import { View, Text } from 'react-native'
import React from 'react'
import { globalStyles } from '../../public/styles'
import GradientButtonWithSlightRadius from '../GradientButtonWithSlightRadius'
import { useNavigation } from '@react-navigation/native'

const RecoveryScoreBriefInfo = ({
    significance,
    briefInfo
}: {
    significance: string
    briefInfo: string
}) => {
    const navigation = useNavigation<any>();
    return (
        <View>
            <Text
                style={[{
                    fontSize: 16,
                    textAlign: 'center'

                }, globalStyles.fontBold]}
            >
                About your Viva Recovery Score

            </Text>


            <Text
                style={[{
                    fontSize: 13,
                    textAlign: 'justify'


                }, globalStyles.fontRegular, { marginTop: 10 }]}
            >
                Significance: {significance}
            </Text>
            <Text
                style={[{
                    fontSize: 12,
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