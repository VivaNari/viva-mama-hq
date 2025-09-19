import React from "react";
import { ScrollView, StyleSheet, Text } from "react-native";

const TermsOfUse = () => {
    return (
        <ScrollView style={styles.container}>
            <Text style={styles.heading}>Terms of Use</Text>

            <Text style={styles.sectionTitle}>1. Acceptance of Terms</Text>
            <Text style={styles.paragraph}>
                By accessing or using our app, you agree to comply with these Terms of
                Use. If you do not agree, please do not use the app.
            </Text>

            <Text style={styles.sectionTitle}>2. User Responsibilities</Text>
            <Text style={styles.paragraph}>
                You are responsible for keeping your account secure and for all
                activities that occur under your account. Misuse of the app may result
                in suspension.
            </Text>

            <Text style={styles.sectionTitle}>3. Modifications</Text>
            <Text style={styles.paragraph}>
                We may update these Terms of Use at any time. Continued use of the app
                after changes means you accept the updated terms.
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

export default TermsOfUse;
