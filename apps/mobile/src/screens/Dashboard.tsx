import { View, Text, Button } from 'react-native'
import React from 'react'
import { globalStyles } from '../public/styles'
import { SafeAreaView } from 'react-native-safe-area-context'

const Dashboard = ({ navigation }: { navigation: { navigate: any } }) => {
    return (
        <SafeAreaView>
            <Text style={[globalStyles.headingxl, { margin: 20 }]}>Welcome Harshaa</Text>
            <Button title='Go to Products' color={'#ff6f61'} onPress={() => { navigation.navigate("Products") }} >
            </Button>
            <Button title='Go to Contents' color={'#ff6f61'} onPress={() => { navigation.navigate("Content") }} >
            </Button>
        </SafeAreaView>
    )
}

export default Dashboard