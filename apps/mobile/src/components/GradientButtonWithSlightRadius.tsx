import React from 'react'
import { Text, TouchableOpacity } from 'react-native'
import LinearGradient from 'react-native-linear-gradient'
import { colors } from '../public/assets/colors'
import { globalStyles } from '../public/styles'

const GradientButtonWithSlightRadius = ({ title, onPress, fullRounded = false, fullWidth = true }: { title: string, onPress: any, fullRounded?: boolean, fullWidth?: boolean }) => {
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
                paddingVertical: fullWidth ? 15 : 8,
                paddingHorizontal: 10,
                flex: fullWidth ? 1 : 0.15,
                marginTop: fullWidth ? 10 : 0
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