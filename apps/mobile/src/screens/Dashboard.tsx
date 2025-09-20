import { useNavigation } from '@react-navigation/native'
import React, { useEffect } from 'react'
import { SafeAreaView } from 'react-native-safe-area-context'
import { globalStyles } from '../public/styles'

const Dashboard = () => {
    const navigation = useNavigation<any>();

    const username = "Harshaa";

    useEffect(() => {
        navigation.setOptions({
            headerTitle: `Welcome, ${username}`,
        });
    }, [navigation, username]);
    return (
        <SafeAreaView
            style={[globalStyles.container]}
        >
        </SafeAreaView>
    )
}

export default Dashboard