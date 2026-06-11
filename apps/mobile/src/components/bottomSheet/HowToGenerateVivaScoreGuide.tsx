import { View, Text, Image } from 'react-native'
import React from 'react'
import { globalStyles } from '../../public/styles'

const HowToGenerateVivaScoreGuide = () => {
    return (
        <View>
            <Text
                style={[{
                    fontSize: 18,
                    textAlign: 'center'

                }, globalStyles.fontBold]}
            >
                How is the Viva Score Generated?

            </Text>

            <View
                style={{
                    borderColor: ''
                }}
            >

                <Image
                    source={require('../../public/assets/images/how_generate_viva_score.png')}
                    style={{
                        width: '100%',
                        height: 220,
                        marginTop: 15,
                        objectFit: 'cover'
                    }}
                />
            </View>


            <Text
                style={[{
                    fontSize: 16,
                    textAlign: 'justify'


                }, globalStyles.fontRegular, { marginTop: 10 }]}
            >
                Your Viva Score is created through your weekly check-ins with Viva AI.
                During each check-in, Viva AI asks a few questions to understand how you’re feeling and recovering.
                Based on your answers, a trained algorithm calculates your Viva Score and updates it on your dashboard.
                These regular updates help you monitor your progress, recognize patterns, and make informed decisions about your recovery journey.
            </Text>
        </View>
    )
}

export default HowToGenerateVivaScoreGuide