import React from 'react'
import { Text, TouchableOpacity } from 'react-native'
import { colors } from '../public/assets/colors'
import { globalStyles } from '../public/styles'

const GradientButtonWithSlightRadius = ({ title, onPress, fullRounded = false, fullWidth = true, disabled = false, style }: { title: string, onPress: any, fullRounded?: boolean, fullWidth?: boolean, disabled?: boolean, style?: any }) => {
    return (
        <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => !disabled && onPress()}
            disabled={disabled}
            style={{
                width: '100%',
                alignItems: 'center',
                borderRadius: !fullRounded ? 10 : 30,
                justifyContent: "center",
                paddingVertical: fullWidth ? 16 : 8,
                paddingHorizontal: fullWidth ? 10 : 20,
                flex: fullWidth ? 1 : 0.15,
                marginTop: fullWidth ? 10 : 0,
                opacity: disabled ? 0.9 : 1,
                backgroundColor: colors.darkPurple,
                ...style
            }}
        >
            <Text
                style={[{
                    color: colors.white,
                    fontSize: 16
                }, globalStyles.fontSemiBold]}
            >
                {title}
            </Text>
        </TouchableOpacity>
    )
}

export default GradientButtonWithSlightRadius