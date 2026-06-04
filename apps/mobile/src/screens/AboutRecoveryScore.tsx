import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../public/assets/colors';
import { globalStyles } from '../public/styles';

const AboutRecoveryScore = () => {
    return (
        <SafeAreaView style={styles.safeArea} edges={['bottom', 'left', 'right']}>
            <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
                
                <Text style={[globalStyles.fontBold, styles.heading]}>
                    What is the Viva Recovery Score?
                </Text>

                <Text style={[globalStyles.fontRegular, styles.paragraph]}>
                    The Viva Recovery Score is a holistic metric designed to help you track your postpartum recovery journey. It combines insights from your physical, emotional, and lactation well-being, gathered through your weekly self check-ins.
                </Text>

                <Text style={[globalStyles.fontRegular, styles.paragraph]}>
                    By completing your check-ins, VivaMama is able to provide you with a high-level view of your progress, allowing you to reflect on areas where you might need more rest, care, or support.
                </Text>

                <Text style={[globalStyles.fontBold, styles.heading, { marginTop: 10 }]}>
                    How is it calculated?
                </Text>

                <Text style={[globalStyles.fontRegular, styles.paragraph]}>
                    Your score is based entirely on the responses you provide during your weekly assessments. The algorithm weighs your physical healing, emotional state, and breastfeeding experiences to generate a personalized snapshot of your current week.
                </Text>

                <View style={styles.disclaimerContainer}>
                    <Text style={[globalStyles.fontBold, styles.disclaimerTitle]}>Disclaimer</Text>
                    <Text style={[globalStyles.fontRegular, styles.disclaimerText]}>
                        Your Viva Recovery Score reflects how you are feeling this week based on your self check-in responses. It is a personal wellness reflection tool, not a medical assessment.
                    </Text>
                    <Text style={[globalStyles.fontRegular, styles.disclaimerText, { marginTop: 5 }]}>
                        VivaMama is not a medical device. The Recovery Score does not diagnose, treat, cure, or prevent any medical condition. It does not replace advice from a qualified healthcare professional.
                    </Text>
                    <Text style={[globalStyles.fontRegular, styles.disclaimerText, { marginTop: 5 }]}>
                        Any suggestions you receive based on your check-in are educational and general in nature, not personalised medical advice.
                    </Text>
                    <Text style={[globalStyles.fontRegular, styles.disclaimerText, { marginTop: 5 }]}>
                        If you have any health concern, please speak with your doctor or a qualified healthcare professional. In an emergency, contact emergency services immediately.
                    </Text>
                </View>

            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: colors.white,
    },
    container: {
        flex: 1,
        paddingHorizontal: 20,
    },
    contentContainer: {
        paddingVertical: 20,
        paddingBottom: 40,
    },
    heading: {
        fontSize: 20,
        color: colors.darkPurple,
        marginBottom: 10,
    },
    paragraph: {
        fontSize: 16,
        color: colors.black,
        marginBottom: 20,
        lineHeight: 24,
    },
    disclaimerContainer: {
        marginTop: 20,
        padding: 15,
        backgroundColor: colors.lightGray,
        borderRadius: 10,
    },
    disclaimerTitle: {
        fontSize: 14,
        color: colors.darkGray,
        marginBottom: 8,
    },
    disclaimerText: {
        fontSize: 12,
        color: colors.darkGray,
    }
});

export default AboutRecoveryScore;
