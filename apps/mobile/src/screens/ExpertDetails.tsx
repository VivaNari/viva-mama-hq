import { useRoute } from "@react-navigation/native";
import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Dimensions,
    Image,
    ScrollView,
    StyleSheet,
    Text,
    View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import LinearGradient from "react-native-linear-gradient";
import GradientButtonWithSlightRadius from "../components/GradientButtonWithSlightRadius";
import { globalStyles } from "../public/styles";
import { colors } from "../public/assets/colors";
import { IExpert, IExpertByIdResponse } from "../types/expert.types";
import { getExpertById } from "../api/getExpertsById";
import Lucide from "@react-native-vector-icons/lucide";

const { width, height } = Dimensions.get("window");

const ExpertDetails = () => {
    const route = useRoute<any>();
    const { expertId } = route.params;
    const [expert, setExpert] = useState<IExpert | undefined>();
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        (async () => {
            try {
                const response: IExpertByIdResponse = await getExpertById(expertId);
                setExpert(response.data);
            } catch (error) {
                console.error("Error fetching expert:", error);
            } finally {
                setLoading(false);
            }
        })();
    }, [expertId]);

    if (loading) {
        return (
            <SafeAreaView style={[globalStyles.container, styles.centerContainer]}>
                <ActivityIndicator size="large" color={colors.primary || colors.purple} />
                <Text style={[styles.loadingText, globalStyles.fontRegular]}>
                    Loading expert details...
                </Text>
            </SafeAreaView>
        );
    }

    if (!expert) {
        return (
            <SafeAreaView style={[globalStyles.container, styles.centerContainer]}>
                <Lucide name="user-x" size={64} color="#ccc" />
                <Text style={[styles.notFoundText, globalStyles.fontSemiBold]}>
                    Expert not found
                </Text>
                <Text style={[styles.notFoundSubtext, globalStyles.fontRegular]}>
                    The expert you're looking for doesn't exist or has been removed.
                </Text>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={[styles.safeArea]}>
            <ScrollView
                style={[styles.scrollView, globalStyles.container]}
                showsVerticalScrollIndicator={false}
            >
                {/* Hero Section with Photo */}
                <View style={styles.heroContainer}>
                    <Image
                        source={{ uri: expert.photograph }}
                        style={styles.heroImage}
                        resizeMode="cover"
                    />
                    <LinearGradient
                        colors={['transparent', 'rgba(0,0,0,0.7)']}
                        style={styles.imageOverlay}
                    >
                        <View style={styles.heroContent}>
                            <Text style={[styles.heroName, globalStyles.fontBold]}>
                                {expert.name}
                            </Text>
                            <View style={styles.specialityBadge}>
                                <Text style={[styles.heroSpeciality, globalStyles.fontSemiBold]}>
                                    {expert.speciality}
                                </Text>
                            </View>
                        </View>
                    </LinearGradient>
                </View>

                {/* Content Section */}
                <View style={styles.contentContainer}>
                    {/* Experience Highlight */}
                    <View style={styles.experienceCard}>
                        <LinearGradient
                            colors={[colors.darkPurple, colors.purple]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={styles.experienceGradient}
                        >
                            <Lucide name="badge-check" size={32} color="#fff" />
                            <View style={styles.experienceTextContainer}>
                                <Text style={[styles.experienceNumber, globalStyles.fontBold]}>
                                    {expert.yearsOfExperience}+ Years
                                </Text>
                                <Text style={[styles.experienceLabel, globalStyles.fontRegular]}>
                                    of Experience
                                </Text>
                            </View>
                        </LinearGradient>
                    </View>

                    {/* Qualification Card */}
                    <View style={styles.infoCard}>
                        <View style={styles.cardHeader}>
                            <Lucide name="school" size={24} color={colors.purple} />
                            <Text style={[styles.cardTitle, globalStyles.fontBold]}>
                                Qualification
                            </Text>
                        </View>
                        <Text style={[styles.cardContent, globalStyles.fontRegular]}>
                            {expert.qualification}
                        </Text>
                    </View>

                    {/* About / Bio Card */}
                    <View style={styles.infoCard}>
                        <View style={styles.cardHeader}>
                            <Lucide name="info" size={24} color={colors.purple} />
                            <Text style={[styles.cardTitle, globalStyles.fontBold]}>
                                About
                            </Text>
                        </View>
                        <Text style={[styles.bioText, globalStyles.fontRegular]}>
                            {expert.bio}
                        </Text>
                    </View>

                    {/* Speciality Details Card */}
                    <View style={styles.infoCard}>
                        <View style={styles.cardHeader}>
                            <Lucide name="briefcase-medical" size={24} color={colors.purple} />
                            <Text style={[styles.cardTitle, globalStyles.fontBold]}>
                                Speciality
                            </Text>
                        </View>
                        <Text style={[styles.cardContent, globalStyles.fontRegular]}>
                            {expert.speciality}
                        </Text>
                    </View>
                </View>
            </ScrollView>

            {/* Fixed Bottom Action Buttons */}
            <View>

                <View style={styles.buttonRow}>
                    <View style={styles.buttonWrapper}>
                        <GradientButtonWithSlightRadius
                            onPress={() => {
                                // Navigate to booking or schedule screen
                                console.log("Book consultation with", expert.name);
                            }}
                            title="Book Consultation"
                        />
                    </View>
                </View>
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: '#f8f9fa',
    },
    scrollView: {
        flex: 1,
        backgroundColor: 'red'
    },
    centerContainer: {
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    loadingText: {
        marginTop: 16,
        fontSize: 16,
        color: '#666',
    },
    notFoundText: {
        marginTop: 16,
        fontSize: 20,
        color: '#333',
    },
    notFoundSubtext: {
        marginTop: 8,
        fontSize: 14,
        color: '#666',
        textAlign: 'center',
    },
    heroContainer: {
        position: 'relative',
        width: width,
        height: height * 0.45,
    },
    heroImage: {
        width: '100%',
        height: '100%',
        backgroundColor: '#f0f0f0',
    },
    imageOverlay: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: '60%',
        justifyContent: 'flex-end',
    },
    heroContent: {
        padding: 20,
        paddingBottom: 30,
    },
    heroName: {
        fontSize: 24,
        color: '#fff',
        marginBottom: 10,
        textShadowColor: 'rgba(0, 0, 0, 0.3)',
        textShadowOffset: { width: 0, height: 2 },
        textShadowRadius: 4,
    },
    specialityBadge: {
        alignSelf: 'flex-start',
        backgroundColor: 'rgba(255, 255, 255, 0.25)',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.4)',
    },
    heroSpeciality: {
        fontSize: 14,
        color: '#fff',
        fontWeight: '600',
    },
    contentContainer: {
        paddingVertical: 20,
    },
    experienceCard: {
        marginBottom: 20,
        borderRadius: 16,
        overflow: 'hidden',
        elevation: 4,
        shadowColor: '#6B4CE6',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
    },
    experienceGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 20,
        gap: 16,
    },
    experienceTextContainer: {
        flex: 1,
    },
    experienceNumber: {
        fontSize: 20,
        color: '#fff',
        marginBottom: 4,
    },
    experienceLabel: {
        fontSize: 14,
        color: 'rgba(255, 255, 255, 0.9)',
    },
    infoCard: {
        backgroundColor: colors.white,
        borderRadius: 16,
        padding: 18,
        marginBottom: 16,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
        gap: 10,
    },
    cardTitle: {
        fontSize: 16,
        color: '#1a1a1a',
    },
    cardContent: {
        fontSize: 15,
        color: '#555',
        lineHeight: 22,
    },
    bioText: {
        fontSize: 15,
        color: '#555',
        lineHeight: 24,
    },
    bottomPadding: {
        height: 100,
    },

    buttonRow: {
        paddingHorizontal: 20,
        paddingTop: 8,
        paddingBottom: 16,
    },
    buttonWrapper: {
        width: '100%',
    },
});

export default ExpertDetails;
