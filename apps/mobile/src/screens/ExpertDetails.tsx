import Lucide from "@react-native-vector-icons/lucide";
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
import LinearGradient from "react-native-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { getExpertById } from "../api/getExpertsById";
import GradientButtonWithSlightRadius from "../components/GradientButtonWithSlightRadius";
import CustomDatePicker from "../components/CustomDatePicker";
import { colors } from "../public/assets/colors";
import { globalStyles } from "../public/styles";
import { IExpert, IExpertByIdResponse, IExpertLoadingState } from "../types/expert.types";
import apiClientInterceptor from "../api/apiClientInterceptor";
import { RAZORPAY_BOOK_CONSULTATION_CREATE_ORDER, RAZORPAY_BOOK_CONSULTATION_VERIFY_ORDER } from "../constants/endpoints";
import { IPaymentOrderResponse } from "../types/subscription.types";
import { RAZORPAY_API_KEY } from "@env";
import RazorpayCheckout from "react-native-razorpay";
import Toast from "react-native-toast-message";

const { height } = Dimensions.get("window");

const ExpertDetails = () => {
    const route = useRoute<any>();
    const { expertId } = route.params;
    const [expert, setExpert] = useState<IExpert | undefined>();
    const [loading, setLoading] = useState<IExpertLoadingState>({
        uiLoading: false,
        paymentLoading: false
    });
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);

    const bookConsultation = async () => {
        try {
            setLoading({
                ...loading,
                paymentLoading: true
            });
            const { data } = await apiClientInterceptor().post(RAZORPAY_BOOK_CONSULTATION_CREATE_ORDER, {
                amount: expert?.remuneration,
                expertId,
                date: selectedDate ? selectedDate.toISOString() : new Date().toISOString()
            }) as { data: IPaymentOrderResponse };

            const options: any = {
                description: `Expert Consultation with ${expert?.name}`,
                image: require("../public/assets/images/viva_logo.png"),
                currency: data.data.currency,
                key: RAZORPAY_API_KEY,
                amount: data.data.amount,
                order_id: data.data.order_id,
                name: `Expert Consultation with ${expert?.name}`,
                prefill: {
                },
                theme: { color: colors.darkPurple }
            }
            RazorpayCheckout.open(options).then(async (data) => {
                try {
                    await apiClientInterceptor().post(RAZORPAY_BOOK_CONSULTATION_VERIFY_ORDER, {
                        razorpay_order_id: data.razorpay_order_id,
                        razorpay_payment_id: data.razorpay_payment_id,
                        razorpay_signature: data.razorpay_signature
                    });

                    setSelectedDate(null);

                    Toast.show({
                        type: 'success',
                        text1: 'Success',
                        text2: 'Consultation Booked Sucessfully!',
                        position: 'bottom'
                    });

                } catch (verifyError) {
                    Toast.show({
                        type: 'error',
                        text1: 'Verification Failed',
                        text2: 'Payment successful but verification failed. Contact support.',
                        position: 'bottom'
                    });
                }
            }).catch((error) => {
                setLoading({
                    ...loading,
                    paymentLoading: false
                });
                Toast.show({
                    type: 'error',
                    text1: 'Error',
                    text2: `Error: ${error.code} | ${error.description}`,
                    position: 'bottom'
                });
                console.error(`Error: ${error.code} | ${error.description}`);
            }).finally(() => {
                setLoading({
                    ...loading,
                    paymentLoading: false
                });
            })
        } catch (error: any) {
            setLoading({
                ...loading,
                paymentLoading: false
            });
            console.error('Payment Error:', error);
            Toast.show({
                type: 'error',
                text1: 'Error',
                text2: 'Something went wrong! Please try again.',
                position: 'bottom'
            });
        }
    }

    useEffect(() => {
        (async () => {
            try {
                setLoading((prev) => ({
                    ...prev,
                    uiLoading: true
                }));
                const response: IExpertByIdResponse = await getExpertById(expertId);
                setExpert(response.data);
            } catch (error) {
                console.error("Error fetching expert:", error);
            } finally {
                setLoading((prev) => ({
                    ...prev,
                    uiLoading: false
                }));
            }
        })();
    }, [expertId]);

    if (loading.uiLoading) {
        return (
            <SafeAreaView style={[globalStyles.container, styles.centerContainer]}>
                <ActivityIndicator size="large" color={colors.darkPurple || colors.purple} />
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
                    {
                        expert.qualification && (

                            <View style={styles.infoCard}>
                                <View style={styles.cardHeader}>
                                    <Lucide name="school" size={20} color={colors.purple} />
                                    <Text style={[styles.cardTitle, globalStyles.fontBold]}>
                                        Qualification
                                    </Text>
                                </View>
                                <Text style={[styles.cardContent, globalStyles.fontRegular]}>
                                    {expert.qualification}
                                </Text>
                            </View>
                        )
                    }

                    {/* About / Bio Card */}
                    {
                        expert.bio && (

                            <View style={styles.infoCard}>
                                <View style={styles.cardHeader}>
                                    <Lucide name="info" size={20} color={colors.purple} />
                                    <Text style={[styles.cardTitle, globalStyles.fontBold]}>
                                        About
                                    </Text>
                                </View>
                                <Text style={[styles.bioText, globalStyles.fontRegular]}>
                                    {expert.bio}
                                </Text>
                            </View>
                        )
                    }

                    {/* Speciality Details Card */}
                    <View style={styles.infoCard}>
                        <View style={styles.cardHeader}>
                            <Lucide name="briefcase-medical" size={20} color={colors.purple} />
                            <Text style={[styles.cardTitle, globalStyles.fontBold]}>
                                Speciality
                            </Text>
                        </View>
                        <Text style={[styles.cardContent, globalStyles.fontRegular]}>
                            {expert.speciality}
                        </Text>
                    </View>

                    {/* Remuneration Card */}
                    <View style={styles.infoCard}>
                        <View style={styles.cardHeader}>
                            <Lucide name="wallet" size={20} color={colors.purple} />
                            <Text style={[styles.cardTitle, globalStyles.fontBold]}>
                                Remuneration
                            </Text>
                        </View>
                        <Text style={[styles.cardContent, globalStyles.fontRegular]}>
                            Rs. {expert.remuneration}/-
                        </Text>
                    </View>
                </View>
            </ScrollView>

            {/* Fixed Bottom Action Buttons */}
            <View>
                <View style={styles.buttonRow}>
                    {/* Date Picker Button */}
                    <View style={styles.dateButtonWrapper}>
                        <GradientButtonWithSlightRadius
                            onPress={() => setShowDatePicker(true)}
                            fullRounded
                            borderedOnly={true}
                            title={selectedDate
                                ? selectedDate.toLocaleDateString('en-GB', {
                                    day: '2-digit',
                                    month: 'short',
                                    year: 'numeric'
                                })
                                : 'Select Date'}
                        />
                    </View>

                    {/* Book Consultation Button */}
                    <View style={styles.buttonWrapper}>
                        <GradientButtonWithSlightRadius
                            onPress={bookConsultation}
                            fullRounded
                            title={loading.paymentLoading ? "Processing..." : 'Book Consultation'}
                            disabled={
                                loading.paymentLoading ||
                                !selectedDate ||
                                (() => {
                                    const today = new Date();
                                    today.setHours(0, 0, 0, 0);
                                    const selected = new Date(selectedDate);
                                    selected.setHours(0, 0, 0, 0);
                                    return selected < today;
                                })()
                            }
                        />
                    </View>
                </View>
            </View>

            <CustomDatePicker
                show={showDatePicker}
                setShow={setShowDatePicker}
                selectedDate={selectedDate}
                onSelect={(date) => setSelectedDate(date)}
                minimumDate={true}
            />
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
        fontSize: 16,
        color: '#666',
        textAlign: 'center',
    },
    heroContainer: {
        position: 'relative',
        width: '100%',
        height: height * 0.45,
        // padding: 20,
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
        shadowColor: colors.purple,
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
        fontSize: 16,
        color: 'rgba(255, 255, 255, 0.9)',
    },
    infoCard: {
        backgroundColor: colors.white,
        borderRadius: 8,
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
        fontSize: 16,
        color: '#555',
        lineHeight: 20,
    },
    bioText: {
        fontSize: 16,
        color: '#555',
        lineHeight: 20,
    },
    bottomPadding: {
        height: 100,
    },

    buttonRow: {
        flexDirection: 'row',
        paddingHorizontal: 20,
        paddingTop: 8,
        paddingBottom: 16,
        gap: 12,
        alignItems: 'center',
    },
    dateButtonWrapper: {
        flex: 0.8,
        flexDirection: 'row',
    },
    buttonWrapper: {
        flex: 1,
        flexDirection: 'row',
    },
});

export default ExpertDetails;
