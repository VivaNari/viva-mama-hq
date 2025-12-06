import { View, Text } from 'react-native'
import React, { ReactNode } from 'react'

const DashboardCard = ({ children }: { children: ReactNode }) => {
    return (
        <View
            style={{
                backgroundColor: 'rgba(255, 250, 250, 1)',
                boxShadow: '0 0 4px 0 rgba(0, 0, 0, 0.25)',
                borderRadius: 10,
                padding: 15,
                marginVertical: 10
            }}
        >
            {children}
        </View>
    )
}

export default DashboardCard