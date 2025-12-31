import React from 'react'
import { Text, TouchableOpacity } from 'react-native'
import LinearGradient from 'react-native-linear-gradient'
import { colors } from '../public/assets/colors'
import { globalStyles } from '../public/styles'

const GradientButtonWithSlightRadius = ({ title, onPress, fullRounded = false, fullWidth = true, disabled = false }: { title: string, onPress: any, fullRounded?: boolean, fullWidth?: boolean, disabled?: boolean }) => {
    return (
        <LinearGradient
            colors={disabled ? ['#ccc', '#bbb'] : [colors.primary, colors.secondary]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{
                borderRadius: !fullRounded ? 10 : 30,
                justifyContent: "center",
                alignItems: "center",
                paddingVertical: fullWidth ? 15 : 8,
                paddingHorizontal: fullWidth ? 10 : 20,
                flex: fullWidth ? 1 : 0.15,
                marginTop: fullWidth ? 10 : 0,
                opacity: disabled ? 0.9 : 1
            }}
        >
            <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => !disabled && onPress()}
                disabled={disabled}
                style={{ width: '100%', alignItems: 'center' }}
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