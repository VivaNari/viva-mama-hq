import React from 'react'
import { Alert, Text, TouchableOpacity, View } from 'react-native'
import LinearGradient from 'react-native-linear-gradient'
import { colors } from '../public/assets/colors'
import { globalStyles } from '../public/styles'

const VivaBuddyRequestCall = () => {
    return (
        <View
            style={{
                flexDirection: "row",
                backgroundColor: colors.white,
                padding: 20,
                gap: 15,
                justifyContent: "space-between",
                borderRadius: 20,
                borderWidth: 1,
                borderColor: colors.purple
            }}
        >
            <View
                style={{ width: '60%' }}
            >
                <Text
                    style={[{
                        fontSize: 16,
                        textAlign: 'center'
                    }, globalStyles.fontRegular]}
                >
                    Request a call with Viva buddy
                </Text>
                <Text
                    style={[{
                        textAlign: 'center',
                        marginTop: 4,
                        fontSize: 12
                    }, globalStyles.fontLight]}
                >
                    Mon - Fri - 10AM - 5PM
                </Text>
            </View>
            <View
                style={{ width: '35%' }}
            >
                <TouchableOpacity
                    style={{ marginVertical: 20 }}
                    onPress={() => Alert.alert("Request Sent", "Your request for a call with Viva Buddy has been sent. Our team will contact you shortly.")}
                >
                    <LinearGradient
                        colors={[colors.primary, colors.secondary]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={{
                            borderRadius: 10,
                            justifyContent: "center",
                            alignItems: "center",
                            paddingVertical: 10
                        }}
                    >
                        <Text
                            style={[{
                                color: colors.white
                            }, globalStyles.fontRegular]}
                        >Request</Text>
                    </LinearGradient>
                </TouchableOpacity>
            </View>
        </View>
    )
}

export default VivaBuddyRequestCall