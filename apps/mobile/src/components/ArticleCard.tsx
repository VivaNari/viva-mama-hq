import { useNavigation } from "@react-navigation/native";
import { Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { globalStyles } from "../public/styles";
import { IUserContent } from "../types/content.types";
import DashboardCard from "./dashboard/DashboardCard";

export const ArticleCard = ({ item, width }: { item: IUserContent, width?: string }) => {
    const navigation = useNavigation() as any;
    return (
        <View
            style={{
                paddingHorizontal: 1,
                width: width === 'full' ? 'auto' : '48%',
            }}
        >

            <DashboardCard>
                <TouchableOpacity
                    onPress={() => navigation.navigate("ArticleDetails", { articleId: item._id })}
                    activeOpacity={0.8}
                    style={styles.articleCard}
                >

                    <Image source={{ uri: item.featuredImage }} style={{
                        ...styles.articleImage,
                        height: width === 'full' ? 250 : 150,
                        width: '100%',
                        borderRadius: 8
                    }} />
                    <View style={{ flex: 1, marginTop: 5, marginHorizontal: 8 }}>
                        <Text style={[styles.articleTitle, globalStyles.fontSemiBold]} numberOfLines={3}>
                            {item.featuredTitle}
                        </Text>
                    </View>
                </TouchableOpacity>
            </DashboardCard>
        </View>
    );
};

const styles = StyleSheet.create({
    articleCard: {
        marginBottom: 12,
        flex: 1,
        alignItems: "center",
    },
    articleImage: {
        // width: '100%',
        // height: 250,
        // borderRadius: 8,
        // objectFit: 'cover'
    },
    articleTitle: {
        fontSize: 16,
    },
    articleDesc: {
        fontSize: 10,
        color: "#555",
        marginTop: 2,
    },
})