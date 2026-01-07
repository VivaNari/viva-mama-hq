import React, { useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { AirbnbRating } from 'react-native-ratings';
import { SafeAreaView } from 'react-native-safe-area-context';
import GradientButtonWithSlightRadius from '../components/GradientButtonWithSlightRadius';
import { colors } from '../public/assets/colors';
import { globalStyles } from '../public/styles';
import { submitConsultationReview } from '../api/submitConsultationReview';
import { useRoute, useNavigation } from '@react-navigation/native';
import Toast from 'react-native-toast-message';
import { SubmitConsultationReviewResponse } from '../types/consultation-review.types';

const ConsultationRating = () => {
    const navigation = useNavigation();
    const route = useRoute() as any;
    const consultationId = route.params?.consultationId;
    const [review, setReview] = useState('');
    const [rating, setRating] = useState(3);
    const [loading, setLoading] = useState(false);

    const submitReview = async () => {
        setLoading(true);
        try {
            const response = (await submitConsultationReview(consultationId, rating, review)) as SubmitConsultationReviewResponse;
            console.log("review response:", response);

            if (response.success) {
                Toast.show({
                    type: 'success',
                    text1: 'Feedback Received',
                    text2: "Thank you! Your feedback helps us improve our care services for you and the community.",
                    position: 'top'
                });
                setReview("");
                setRating(3);

                // Navigate back after a short delay
                setTimeout(() => {
                    navigation.canGoBack() ?
                        navigation.goBack() :
                        navigation.navigate("DashboardTabNavigator" as never)
                }, 2000);
            }
        } catch (error) {
            console.error("Error submitting review:", error);
            Toast.show({
                type: 'error',
                text1: 'Error',
                text2: "Something went wrong. Please try again.",
                position: 'top'
            });
        } finally {
            setLoading(false);
        }
    }

    return (
        <SafeAreaView style={{ flex: 1 }}>
            <ScrollView style={[globalStyles.container]} keyboardShouldPersistTaps="handled">
                {/* Logo */}
                <View
                    style={{
                        alignItems: 'center',
                    }}
                >
                    <Text
                        style={[
                            {
                                fontSize: 25,
                                flexShrink: 1,
                                color: colors.darkPurple,
                                textAlign: 'center',
                            },
                            globalStyles.fontBold
                        ]}
                    >
                        Rate your consultation experience
                    </Text>
                    <Text
                        style={[
                            {
                                fontSize: 16,
                                flexShrink: 1,
                                color: colors.white,
                                textAlign: 'center',
                            },
                            globalStyles.fontSemiBold
                        ]}
                    >
                        Help us to improve our service!
                    </Text>
                </View>
                <View
                    style={{
                        marginVertical: 25
                    }}
                >
                    <AirbnbRating
                        count={5}
                        reviews={["Terrible", "Bad", "OK", "Good", "Great"]}
                        defaultRating={rating}
                        size={40}
                        onFinishRating={(ratingVal) => {
                            setRating(ratingVal);
                        }}
                        selectedColor={colors.darkPurple}
                        starImage={require('../public/assets/images/star-outline.png')}
                        isDisabled={loading}
                    />
                </View>
                {/* Login Options */}
                <View style={{ gap: 10 }}>
                    <View>
                        <TextInput
                            inputMode="text"
                            selectionColor={colors.darkPurple}
                            placeholderTextColor={colors.black}
                            numberOfLines={5}
                            multiline
                            placeholder={'Enter your review (optional)'}
                            style={[globalStyles.input, globalStyles.fontSemiBold, { backgroundColor: colors.lightGray, borderWidth: 1, borderColor: colors.darkPurple, color: colors.black, height: 200, textAlignVertical: 'top' }]}
                            onChangeText={setReview}
                            value={review}
                            editable={!loading}
                        />

                    </View>
                </View>
            </ScrollView>
            <View
                style={{
                    flexDirection: 'row',
                    paddingHorizontal: 15,
                    paddingBottom: 10
                }}
            >

                <GradientButtonWithSlightRadius
                    title='Submit Review'
                    onPress={() => { submitReview() }}
                    disabled={rating === 0 || loading}
                />
            </View>
        </SafeAreaView >
    );
}

export default ConsultationRating