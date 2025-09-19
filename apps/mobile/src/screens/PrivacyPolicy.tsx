import React from "react";
import { View, Text, ScrollView, StyleSheet } from "react-native";

const PrivacyPolicy = () => {
    return (
        <ScrollView style={styles.container}>
            <Text style={styles.heading}>Privacy Policy</Text>

            <Text style={styles.sectionTitle}>1. Information We Collect</Text>
            <Text style={styles.paragraph}>
                We may collect personal information such as your name, email, and app
                usage data to improve your experience.
            </Text>

            <Text style={styles.sectionTitle}>2. How We Use Information</Text>
            <Text style={styles.paragraph}>
                The information collected is used to provide services, improve features,
                and communicate with you about updates.
            </Text>

            <Text style={styles.sectionTitle}>3. Data Security</Text>
            <Text style={styles.paragraph}>
                We implement industry-standard security measures to protect your
                information. However, no system is 100% secure.
            </Text>

            <Text style={styles.sectionTitle}>4. Contact Us</Text>
            <Text style={styles.paragraph}>
                If you have any questions about this Privacy Policy, please contact us
                at support@example.com.
            </Text>
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, padding: 16, backgroundColor: "#fff" },
    heading: { fontSize: 22, fontWeight: "bold", marginBottom: 16 },
    sectionTitle: { fontSize: 16, fontWeight: "600", marginTop: 12 },
    paragraph: { fontSize: 14, lineHeight: 20, marginTop: 4, color: "#555" },
});

export default PrivacyPolicy;
