import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from "react-native";
import { IUserProfile } from "../types/profile.types";
import { profileFormFields } from "../data/profileForm";
import { styles } from "../public/styles/profileStyles";
import { colors } from "../public/assets/colors";
import LinearGradient from "react-native-linear-gradient";
import { globalStyles } from "../public/styles";
import GradientButtonWithSlightRadius from "../components/GradientButtonWithSlightRadius";

const EditProfile = () => {
    const [profile, setProfile] = useState<IUserProfile>({
        name: "Harsha Tomar",
        age: 29,
        height: "160 CM",
        email: "harshatomar@gmail.com",
    });

    const handleChange = (key: keyof IUserProfile, value: string) => {
        setProfile({
            ...profile,
            [key]: key === "age" ? Number(value) : value,
        });
    };

    const handleSave = () => {
        console.log("Saved Profile:", profile);
    };

    return (
        <View style={styles.container}>
            <View
                style={{
                    flex: 1
                }}
            >

                {profileFormFields.map((field) => (
                    <View key={field.key} style={styles.input}>
                        <Text style={[[styles.label, globalStyles.fontRegular]]}>{field.label}</Text>
                        <TextInput
                            placeholderTextColor={colors.black}
                            style={[{ fontSize: 16 }, globalStyles.fontRegular]}
                            placeholder={field.placeholder}
                            value={String(profile[field.key] ?? "")}
                            keyboardType={
                                field.type === "number"
                                    ? "numeric"
                                    : field.type === "email"
                                        ? "email-address"
                                        : "default"
                            }
                            onChangeText={(text) => handleChange(field.key, text)}
                        />
                    </View>
                ))}
            </View>
            <TouchableOpacity
                onPress={handleSave}
                style={{ marginVertical: 20 }}
            >
                <LinearGradient
                    colors={[colors.darkPurple, colors.purple]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.saveButton}
                >
                    <Text
                        style={[styles.saveText, globalStyles.fontRegular]}
                    >Save</Text>
                </LinearGradient>
            </TouchableOpacity>
        </View>
    );
};

export default EditProfile;

