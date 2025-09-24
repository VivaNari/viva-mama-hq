import { Text, TouchableOpacity } from "react-native";
import { styles } from "../../public/styles/notificationStyles";
import { IRecommendationItem } from "../../types/recommendation.types";
import { globalStyles } from "../../public/styles";
import React from "react";


const FLItemRecommendation = ({
    item,
    navigation,
    onlyTitle = false
}: {
    item: IRecommendationItem,
    navigation: { navigate: any },
    onlyTitle?: boolean
}) => (
    <TouchableOpacity
        style={[styles.card, { flexShrink: 1 }]}
        onPress={() => {
            navigation.navigate("RecommendationDetails", { recommendationId: item.id })
        }}
    >

        {
            !onlyTitle ? (
                <React.Fragment>
                    <Text style={[styles.title, globalStyles.fontMedium]}>{item.title}</Text>
                    <Text style={[styles.message, globalStyles.fontRegular]} numberOfLines={2}>
                        {item.content}
                    </Text>
                </React.Fragment>
            ) : (
                <Text style={[styles.title, globalStyles.fontRegular, { fontSize: 12 }]}>{item.title}</Text>
            )
        }
    </TouchableOpacity>
);

export default FLItemRecommendation;