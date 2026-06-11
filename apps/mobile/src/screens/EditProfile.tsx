import React, { useEffect, useState } from "react";
import { Text, TextInput, TouchableOpacity, View } from "react-native";
import LinearGradient from "react-native-linear-gradient";
import { useAuth } from "../context/AuthContext";
import { chatDB } from "../db/sqlite";
import { colors } from "../public/assets/colors";
import { globalStyles } from "../public/styles";
import { styles } from "../public/styles/profileStyles";
import { IUserAllData } from "../types/dashboard.types";
import CustomDatePicker from "../components/CustomDatePicker";
import { syncUserData } from "../utils/syncUserData";
import { updateUserData } from "../api/updateuserData";
import { ActivityIndicator } from "react-native";
import Toast from "react-native-toast-message";

const EditProfile = () => {

    const [userData, setUserdata] = useState<IUserAllData>();
    const { userId, userToken } = useAuth();
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [name, setName] = useState<string>("");
    const [location, setLocation] = useState<string>("");
    const [loading, setLoading] = useState<boolean>(false);

    const handleDateSelected = async (date: Date) => {
        setSelectedDate(date);
        setShowDatePicker(false);
    };

    useEffect(() => {
        (async function () {

            let getUserDataFromSQLite = await chatDB.getUserData(userId as string);
            console.log("getUserDataFromSQLite is================> ", getUserDataFromSQLite);

            // Fallback: If no data in SQLite, try to sync from API
            if (!getUserDataFromSQLite && userToken) {
                console.log("[EDIT PROFILE] No local data, attempting fallback sync...");
                await syncUserData(userToken);
                getUserDataFromSQLite = await chatDB.getUserData(userId as string);
            }

            if (getUserDataFromSQLite) {
                setUserdata(getUserDataFromSQLite.data);
            }
        })()
    }, [userId, userToken]);

    useEffect(() => {
        if (userData) {
            setSelectedDate(new Date(userData.user.onboarding_data.date_of_birth as Date));
            setName(userData.user.onboarding_data.preferred_name || "");
            setLocation(userData.user.onboarding_data.location || "");
        }
    }, [userData])

    const handleSave = async () => {
        if (!userId || !userToken) return;

        try {
            setLoading(true);
            const response = await updateUserData({
                preferred_name: name,
                location: location,
                date_of_birth: selectedDate?.toISOString() || new Date().toISOString()
            });

            if (response.success) {
                // Refresh local database
                await syncUserData(userToken);

                Toast.show({
                    type: 'success',
                    text1: 'Success',
                    text2: 'Profile updated successfully!',
                    position: 'bottom'
                });
            } else {
                Toast.show({
                    type: 'error',
                    text1: 'Error',
                    text2: response.message || 'Failed to update profile',
                    position: 'bottom'
                });
            }
        } catch (error) {
            console.error("Error updating profile:", error);
            Toast.show({
                type: 'error',
                text1: 'Error',
                text2: 'Something went wrong while updating profile',
                position: 'bottom'
            });
        } finally {
            setLoading(false);
        }
    }

    return (
        <View style={styles.container}>
            <View
                style={{
                    flex: 1
                }}
            >

                <View style={styles.input}>
                    <Text style={[[styles.label, globalStyles.fontRegular]]}>Your Name</Text>
                    <TextInput
                        placeholderTextColor={colors.black}
                        style={[{ fontSize: 16 }, globalStyles.fontRegular]}
                        placeholder={"Enter your name"}
                        value={name}
                        onChangeText={setName}
                        keyboardType={"default"}
                    />
                </View>
                <View style={styles.input}>
                    <Text style={[[styles.label, globalStyles.fontRegular]]}>Your Location</Text>
                    <TextInput
                        placeholderTextColor={colors.black}
                        style={[{ fontSize: 16 }, globalStyles.fontRegular]}
                        placeholder={"Enter your Location"}
                        value={location}
                        onChangeText={setLocation}
                        keyboardType={"default"}
                    />
                </View>
                <TouchableOpacity
                    style={styles.input}
                    onPress={() => setShowDatePicker(true)}
                    activeOpacity={0.7}
                >
                    <Text style={[[styles.label, globalStyles.fontRegular]]}>Your Date of Birth</Text>
                    <TextInput
                        placeholderTextColor={colors.black}
                        style={[{ fontSize: 16 }, globalStyles.fontRegular]}
                        placeholder={"Choose Date"}
                        value={selectedDate ? selectedDate.toLocaleDateString('en-GB', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric'
                        }) : "Choose Date"}
                        editable={false}
                        pointerEvents="none"
                    />
                </TouchableOpacity>
            </View>
            <TouchableOpacity
                onPress={handleSave}
                style={{ marginVertical: 20 }}
                disabled={loading}
            >
                <LinearGradient
                    colors={[colors.darkPurple, colors.purple]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.saveButton}
                >
                    {loading ? (
                        <ActivityIndicator color={colors.white} />
                    ) : (
                        <Text
                            style={[styles.saveText, globalStyles.fontRegular]}
                        >Save</Text>
                    )}
                </LinearGradient>
            </TouchableOpacity>
            <CustomDatePicker
                show={showDatePicker}
                setShow={setShowDatePicker}
                selectedDate={selectedDate}
                onSelect={handleDateSelected}
                minimumDate={false}
            />
        </View>
    );
};

export default EditProfile;

