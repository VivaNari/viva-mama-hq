import React from 'react'
import { Text, TouchableOpacity } from 'react-native'
import LinearGradient from 'react-native-linear-gradient'
import { colors } from '../public/assets/colors'
import { globalStyles } from '../public/styles'

const GradientButtonWithSlightRadius = ({ title, onPress, fullRounded = false }: { title: string, onPress: any, fullRounded?: boolean }) => {
    return (
        <LinearGradient
            onTouchEnd={() => onPress()}
            colors={[colors.primary, colors.secondary]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            onMagicTap={() => onPress()}
            style={{
                borderRadius: !fullRounded ? 10 : 30,
                justifyContent: "center",
                alignItems: "center",
                paddingVertical: 15,
                paddingHorizontal: 10,
                flex: 1,
                marginTop: 10
            }}
        >
            <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => onPress()}
            >
                <Text
                    style={[{
                        color: colors.white,
                        fontSize: 14
                    }, globalStyles.fontRegular]}
                >
                    {title}
                </Text>
            </TouchableOpacity>
        </LinearGradient>
    )
}

export default GradientButtonWithSlightRadius