import React, { useEffect, useState } from 'react'
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native'
import LinearGradient from 'react-native-linear-gradient'
import Toast from 'react-native-toast-message'
import { requestCallback } from '../api/requestCallback'
import { useAuth } from '../context/AuthContext'
import { chatDB } from '../db/sqlite'
import { colors } from '../public/assets/colors'
import { globalStyles } from '../public/styles'
import { IRequestCallbackResponse } from '../types/careManager.types'

const VivaBuddyRequestCall = () => {
    const [careManagerId, setCareManagerId] = useState<string>();
    const [loading, setLoading] = useState<boolean>(false);
    const { userId } = useAuth();
    useEffect(() => {
        if (!userId) return;
        (async () => {
            try {
                const getUserDataFromSQLite = await chatDB.getUserData(userId as string);
                if (getUserDataFromSQLite && getUserDataFromSQLite.data.caremanager) {
                    setCareManagerId(getUserDataFromSQLite.data.caremanager.id);
                }
            } catch (error) {
                console.error("Error loading care manager data:", error);
            }
        })()
    }, [userId])
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
                    Request a call with your Care Manager
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
                    style={{ marginVertical: 20, opacity: loading ? 0.5 : 1 }}
                    disabled={loading}
                    activeOpacity={1}
                    onPress={async () => {
                        if (careManagerId) {
                            try {
                                setLoading(true);
                                const requestcallbackResponse = await requestCallback(careManagerId) as IRequestCallbackResponse;
                                if (requestcallbackResponse.success) {
                                    Toast.show({
                                        type: 'success',
                                        text1: 'Success!',
                                        text2: 'Callback requested successfully!',
                                        position: 'bottom',

                                    });
                                } else {
                                    Toast.show({
                                        type: 'success',
                                        text1: 'Error!',
                                        text2: 'Something went wrong!',
                                        position: 'bottom',

                                    });
                                }
                            } catch (error) {
                                console.log(error);
                                Toast.show({
                                    type: 'success',
                                    text1: 'Error!',
                                    text2: 'Something went wrong!' + error,
                                    position: 'bottom',

                                });
                            } finally {
                                setLoading(false);
                            }
                        }
                    }}
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
                        {
                            loading ? (
                                <ActivityIndicator size="small" color={colors.white} />
                            ) : (
                                <Text
                                    style={[{
                                        color: colors.white
                                    }, globalStyles.fontRegular]}
                                >
                                    Request
                                </Text>
                            )
                        }
                    </LinearGradient>
                </TouchableOpacity>
            </View>
        </View >
    )
}

export default VivaBuddyRequestCall