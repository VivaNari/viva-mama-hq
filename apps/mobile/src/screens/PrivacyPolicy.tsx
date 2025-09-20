import React from "react";
import { View, Text, ScrollView, StyleSheet, Image } from "react-native";
import { ContentDetailsStyles } from "../public/styles/contentStyles";
import { globalStyles } from "../public/styles";

const PrivacyPolicy = () => {
    return (
        <ScrollView>
            <Image source={require("../public/assets/images/single_article_breadcrumb.png")} style={ContentDetailsStyles.image} />

            <View
                style={globalStyles.container}
            >

                <Text style={[styles.sectionTitle, globalStyles.fontMedium]}>1. Information We Collect</Text>
                <Text style={[styles.paragraph, globalStyles.fontRegular]}>
                    We may collect personal information such as your name, email, and app
                    usage data to improve your experience.
                </Text>

                <Text style={[styles.sectionTitle, globalStyles.fontMedium]}>2. How We Use Information</Text>
                <Text style={[styles.paragraph, globalStyles.fontRegular]}>
                    The information collected is used to provide services, improve features,
                    and communicate with you about updates.
                </Text>

                <Text style={[styles.sectionTitle, globalStyles.fontMedium]}>3. Data Security</Text>
                <Text style={[styles.paragraph, globalStyles.fontRegular]}>
                    We implement industry-standard security measures to protect your
                    information. However, no system is 100% secure.
                </Text>

                <Text style={[styles.sectionTitle, globalStyles.fontMedium]}>4. Contact Us</Text>
                <Text style={[styles.paragraph, globalStyles.fontRegular]}>
                    If you have any questions about this Privacy Policy, please contact us
                    at support@example.com.
                </Text>
            </View>
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
