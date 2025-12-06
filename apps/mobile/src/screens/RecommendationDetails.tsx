import { MaterialDesignIcons } from "@react-native-vector-icons/material-design-icons";
import { useRoute } from "@react-navigation/native";
import React from "react";
import {
    Image,
    ScrollView,
    Text,
    TouchableOpacity,
    View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { contentsData } from "../data/contentsData";
import { globalStyles } from "../public/styles";
import { ContentDetailsStyles } from "../public/styles/contentStyles";
import { IContent } from "../types/content.types";
import Share from 'react-native-share';
import { IRecommendationItem } from "../types/recommendation.types";
import { recommendationsData } from "../data/recommendationsData";
import { colors } from "../public/assets/colors";


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


