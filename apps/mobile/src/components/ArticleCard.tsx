import { Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { IContent } from "../types/content.types";
import { useNavigation } from "@react-navigation/native";

export const ArticleCard = ({ item }: { item: IContent }) => {
    const navigation = useNavigation() as any;
    return (
        <TouchableOpacity
            onPress={() => navigation.navigate("ArticleDetails", { articleId: item.id })}
            activeOpacity={0.8}
            style={styles.articleCard}
        >
            <Image source={item.thumbnailImage} style={styles.articleImage} />
            <View style={{ flex: 1 }}>
                <Text style={styles.articleTitle} numberOfLines={1}>
                    {item.title}
                </Text>
                <Text style={styles.articleDesc} numberOfLines={2}>
                    {item.content}
                </Text>
            </View>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    articleCard: {
        flexDirection: "row",
        marginBottom: 12,
        alignItems: "center",
    },
    articleImage: {
        width: 60,
        height: 60,
        borderRadius: 8,
        marginRight: 12,
    },
    articleTitle: {
        fontSize: 14,
        fontWeight: "600",
    },
    articleDesc: {
        fontSize: 12,
        color: "#555",
        marginTop: 2,
    },
})