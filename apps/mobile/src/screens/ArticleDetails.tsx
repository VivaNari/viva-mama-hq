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


const ArticleDetails = () => {
    const route = useRoute<any>();
    const { articleId } = route.params;

    let article: IContent | undefined;

    for (const category of contentsData) {
        for (const sub of category.subCategories) {
            const found = sub.contents.find((c) => c.id === articleId);
            if (found) {
                article = found;
                break;
            }
        }
    }

    if (!article) {
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
                {/* Banner Image */}
                <Image source={article.thumbnailImage} style={ContentDetailsStyles.image} />

                {/* Title + Author */}
                <View style={globalStyles.container}>
                    <Text style={[ContentDetailsStyles.title, globalStyles.fontSemiBold]}>{article.title}</Text>
                    <Text style={[ContentDetailsStyles.author, globalStyles.fontRegular]}>Written by {article.author}</Text>

                    {/* Action Buttons */}
                    <View style={ContentDetailsStyles.actions}>
                        <TouchableOpacity
                            style={ContentDetailsStyles.iconButton}
                            onPress={() => {
                                Share.open({
                                    title: article.title,
                                    message: `${article.title} \n\n ${article.content}`,
                                })
                                    .then((res) => {
                                        console.log(res);
                                    })
                                    .catch((err) => {
                                        err && console.log(err);
                                    });
                            }}
                        >
                            <MaterialDesignIcons name="share-variant" size={22} color="#333" />
                        </TouchableOpacity>
                        <TouchableOpacity style={ContentDetailsStyles.iconButton}>
                            <MaterialDesignIcons
                                name={article.isBookmarked ? "bookmark" : "bookmark-outline"}
                                size={22}
                                color="#333"
                            />
                        </TouchableOpacity>
                    </View>
                    <View>
                        <Text
                            style={[ContentDetailsStyles.content, globalStyles.fontRegular]}
                        >
                            {article.content}
                        </Text>
                    </View>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
};

export default ArticleDetails;


