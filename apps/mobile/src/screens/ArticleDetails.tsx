import { MaterialDesignIcons } from "@react-native-vector-icons/material-design-icons";
import { useRoute } from "@react-navigation/native";
import React, { useEffect } from "react";
import {
    ActivityIndicator,
    Image,
    ScrollView,
    Text,
    TouchableOpacity,
    View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Share from 'react-native-share';
import { getUserContentById } from "../api/getUserContentById";
import { colors } from "../public/assets/colors.ts";
import { globalStyles } from "../public/styles";
import { ContentDetailsStyles } from "../public/styles/contentStyles";
import { ContentBodyTypeEnum, IUserContent, IUserContentresponse } from "../types/content.types.ts";

const renderContentBody = (article: IUserContent) => {
    if (!article?.contentBody?.length) return null;

    return article.contentBody.map((item) => {
        switch (item.contentType) {
            case ContentBodyTypeEnum.HEADING:
                return (
                    <Text
                        key={item._id}
                        style={[ContentDetailsStyles.heading, globalStyles.fontSemiBold]}
                    >
                        {item.body}
                    </Text>
                );

            case ContentBodyTypeEnum.SUBHEADING:
                return (
                    <Text
                        key={item._id}
                        style={[ContentDetailsStyles.subHeading, globalStyles.fontMedium]}
                    >
                        {item.body}
                    </Text>
                );

            case ContentBodyTypeEnum.PARAGRAPH:
                return (
                    <Text
                        key={item._id}
                        style={[ContentDetailsStyles.content, globalStyles.fontRegular]}
                    >
                        {item.body}
                    </Text>
                );

            default:
                return null;
        }
    });
};


const ArticleDetails = () => {
    const route = useRoute<any>();
    const { articleId } = route.params;
    const [article, setArticle] = React.useState<IUserContent | null>(null);
    const [loading, setLoading] = React.useState<boolean>(false);

    useEffect(() => {
        (async () => {
            setLoading(true);
            const getContentById: IUserContentresponse = await getUserContentById(articleId);
            setArticle(getContentById.data[0]);
            setLoading(false);
        })()
    }, [articleId])

    if (loading) {
        return (
            <SafeAreaView style={ContentDetailsStyles.center}>
                <ActivityIndicator size="large" color={colors.purple} />
            </SafeAreaView>
        );
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
                <Image source={{ uri: article.featuredImage }} style={ContentDetailsStyles.image} />

                {/* Title + Author */}
                <View style={globalStyles.container}>
                    <Text style={[ContentDetailsStyles.title, globalStyles.fontSemiBold]}>{article.featuredTitle}</Text>
                    <Text style={[ContentDetailsStyles.author, globalStyles.fontRegular]}>Written by Dr. Harsha Tomar</Text>

                    {/* Action Buttons */}
                    <View style={ContentDetailsStyles.actions}>
                        <TouchableOpacity
                            style={ContentDetailsStyles.iconButton}
                            onPress={() => {
                                Share.open({
                                    title: article.featuredTitle,
                                    message: `${article.featuredTitle} \n\n ${article.contentBody}`,
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
                                name={"bookmark"}
                                size={22}
                                color="#333"
                            />
                        </TouchableOpacity>
                    </View>
                    {renderContentBody(article)}
                </View>
            </ScrollView>
        </SafeAreaView>
    );
};

export default ArticleDetails;


