import React from "react";
import { Image, ScrollView, StyleSheet, Text, View } from "react-native";
import { globalStyles } from "../public/styles";
import { ContentDetailsStyles } from "../public/styles/contentStyles";

const TermsOfUse = () => {
    return (
        <ScrollView >
            <Image source={require("../public/assets/images/single_article_breadcrumb.png")} style={ContentDetailsStyles.image} />

            <View
                style={globalStyles.container}
            >
                <Text style={[styles.sectionTitle, globalStyles.fontMedium]}>1. Acceptance of Terms</Text>
                <Text style={[styles.paragraph, globalStyles.fontRegular]}>
                    By accessing or using our app, you agree to comply with these Terms of
                    Use. If you do not agree, please do not use the app.
                </Text>

                <Text style={[styles.sectionTitle, globalStyles.fontMedium]}>2. User Responsibilities</Text>
                <Text style={[styles.paragraph, globalStyles.fontRegular]}>
                    You are responsible for keeping your account secure and for all
                    activities that occur under your account. Misuse of the app may result
                    in suspension.
                </Text>

                <Text style={[styles.sectionTitle, globalStyles.fontMedium]}>3. Modifications</Text>
                <Text style={[styles.paragraph, globalStyles.fontRegular]}>
                    We may update these Terms of Use at any time. Continued use of the app
                    after changes means you accept the updated terms.
                </Text>
            </View>
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    heading: { fontSize: 22, marginBottom: 16 },
    sectionTitle: { fontSize: 16, fontWeight: "600", marginTop: 12 },
    paragraph: { fontSize: 12, lineHeight: 20, marginTop: 4, color: "#555" },
});

export default TermsOfUse;
