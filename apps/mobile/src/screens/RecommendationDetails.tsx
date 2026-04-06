import { useRoute } from "@react-navigation/native";
import React from "react";
import {
    Image,
    ScrollView,
    Text,
    View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { recommendationsData } from "../data/recommendationsData";
import { colors } from "../public/assets/colors";
import { globalStyles } from "../public/styles";
import { ContentDetailsStyles } from "../public/styles/contentStyles";
import { IRecommendationItem } from "../types/recommendation.types";


const RecommendationDetails = () => {
    const route = useRoute<any>();
    const { recommendationId } = route.params;

    let recommendation: IRecommendationItem | undefined;

    recommendation = recommendationsData.find((item) => item.id === recommendationId);

    if (!recommendation) {
        return (
            <SafeAreaView style={ContentDetailsStyles.center}>
                <Text
                    style={[globalStyles.fontRegular]}
                >
                    Article not found.
                </Text>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={{ flex: 1 }}>
            <ScrollView contentContainerStyle={ContentDetailsStyles.scrollContent}>

                {/* Title + Author */}
                <View style={globalStyles.container}>
                    <Text style={[ContentDetailsStyles.title, globalStyles.fontSemiBold, {
                        paddingBottom: 10,
                        borderBottomWidth: 1,
                        borderColor: colors.gray,
                        marginBottom: 10
                    }]}>{recommendation.title}</Text>
                    <View>
                        <Text
                            style={[ContentDetailsStyles.content, globalStyles.fontRegular]}
                        >
                            {recommendation.content}
                        </Text>
                    </View>

                    <Image
                        source={recommendation.image}
                        style={{
                            width: '100%',
                            height: 500,
                            resizeMode: 'contain',
                            marginTop: 15,
                            borderRadius: 8
                        }}
                    />
                </View>
            </ScrollView>
        </SafeAreaView>
    );
};

export default RecommendationDetails;


