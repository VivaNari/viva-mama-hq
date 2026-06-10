import React, { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import Toast from 'react-native-toast-message';
import { colors } from '../public/assets/colors';
import { globalStyles } from '../public/styles';
import GradientButtonWithSlightRadius from './GradientButtonWithSlightRadius';
import { requestCallback } from '../api/requestCallback';
import { chatDB } from '../db/sqlite';
import { IRequestCallbackResponse } from '../types/careManager.types';
import { useAuth } from '../context/AuthContext';
import CustomDatePicker from './CustomDatePicker';

const CareManagerCard = () => {
    const [careManagerId, setCareManagerId] = useState<string>();
    const { userId } = useAuth();

    const [loading, setLoading] = useState<boolean>(false);
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
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

    const handleDateSelected = async (date: Date) => {
        setSelectedDate(date);
        setShowDatePicker(false);

        // Call the API after date is selected
        if (careManagerId) {
            try {
                setLoading(true);
                const requestcallbackResponse = await requestCallback(
                    careManagerId,
                    date.toISOString()
                ) as IRequestCallbackResponse;
                if (requestcallbackResponse.success) {
                    // Toast.show({
                    //     type: 'success',
                    //     text1: 'Success!',
                    //     text2: 'Your request has been registered and you will receive a call back within 24 hours!',
                    //     position: 'bottom',
                    // });
                    Alert.alert(
                        'Success!',
                        `Your request has been registered and you will receive a call back on ${date.toDateString()}!`,
                        [{ text: 'OK', onPress: () => setSelectedDate(null) }]
                    );
                } else {
                    Toast.show({
                        type: 'error',
                        text1: 'Error!',
                        text2: 'Something went wrong!',
                        position: 'bottom',
                    });
                }
            } catch (error) {
                console.log(error);
                Toast.show({
                    type: 'error',
                    text1: 'Error!',
                    text2: 'Something went wrong! ' + error,
                    position: 'bottom',
                });
            } finally {
                setLoading(false);
            }
        }
    };

    return (
        <View
            style={{
                marginVertical: 15,
            }}
        >
            <View
                style={{
                    backgroundColor: colors.white,
                    padding: 10,
                    borderRadius: 10,
                    overflow: 'hidden',
                    boxShadow: '0 0 4px 0 rgba(0, 0, 0, 0.25)',
                    paddingBottom: 20
                }}
            >
                <View>
                    <View
                        style={{
                            ...StyleSheet.absoluteFillObject,
                            backgroundColor: colors.white,
                        }}
                    />
                    <View
                        style={{
                            paddingTop: 20,
                            alignItems: 'center'
                        }}
                    >
                        <Text
                            style={[{
                                fontSize: 20,
                                textAlign: 'center'

                            }, globalStyles.fontBold]}
                        >
                            Hey Mama! I am your care manager!
                        </Text>
                    </View>

                    <View style={{ marginTop: 20 }}>
                        <View

                        >

                            <Text style={[globalStyles.fontRegular, { fontSize: 16, color: colors.darkGray, textAlign: 'center' }]}>
                                Hey mama! I'm your dedicated care manager whenever you need support or want to talk to someone who understands, you can request a call anytime. I'm here to help.
                            </Text>
                        </View>
                    </View>

                    <View
                        style={{

                            flexDirection: "row",
                        }}
                    >
                        <GradientButtonWithSlightRadius
                            title='Request a Call back'
                            fullWidth={true}
                            fullRounded={true}
                            style={{
                                marginTop: 20,
                                opacity: loading ? 0.5 : 1
                            }}
                            disabled={loading}
                            onPress={() => {
                                if (careManagerId) {
                                    setShowDatePicker(true);
                                }
                            }}
                        />
                    </View>
                </View>
            </View>
            <CustomDatePicker
                show={showDatePicker}
                setShow={setShowDatePicker}
                selectedDate={selectedDate}
                onSelect={handleDateSelected}
                minimumDate={true}
            />
        </View>
    );
};

export default CareManagerCard;
