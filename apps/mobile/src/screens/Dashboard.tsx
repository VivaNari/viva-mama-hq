import { View, Text, Button } from 'react-native'
import React from 'react'
import { globalStyles } from '../public/styles'

const Dashboard = ({ navigation }: { navigation: { navigate: any } }) => {
    return (
        <View>
            <Text style={[globalStyles.headingxl, { margin: 20 }]}>Welcome Harshaa</Text>
            <Button title='Go to Products' color={'#ff6f61'} onPress={() => { navigation.navigate("Products") }} >
            </Button>
        </View>
    )
}

export default Dashboard