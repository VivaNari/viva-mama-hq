import { useNavigation } from '@react-navigation/native'
import React, { useEffect } from 'react'
import { SafeAreaView } from 'react-native-safe-area-context'
import { globalStyles } from '../public/styles'
import GradientButtonWithSlightRadius from '../components/GradientButtonWithSlightRadius'
import { View } from 'react-native'

const Dashboard = () => {
    const navigation = useNavigation<any>();

    const username = "Harshaa";

    useEffect(() => {
        navigation.setOptions({
            headerTitle: `Hi, ${username}`,
        });
    }, [navigation, username]);
    return (
        <SafeAreaView
            style={[globalStyles.container]}
        >
            <View
                style={{
                    // flex: 1,
                    flexDirection: 'row'
                }}
            >


                <GradientButtonWithSlightRadius
                    title='View Full Report'
                    onPress={() => { navigation.navigate('FullReport') }}
                />
            </View>
        </SafeAreaView>
    )
}

export default Dashboard