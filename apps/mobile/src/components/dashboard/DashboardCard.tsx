import React, { ReactNode } from 'react'
import { View } from 'react-native'

const DashboardCard = ({ children, style }: { children: ReactNode, style?: {} }) => {
    return (
        <View
            style={{
                backgroundColor: 'rgba(255, 250, 250, 1)',
                boxShadow: '0 0 4px 0 rgba(0, 0, 0, 0.25)',
                borderRadius: 10,
                padding: 15,
                marginVertical: 10,
                ...style
            }}
        >
            {children}
        </View>
    )
}

export default DashboardCard