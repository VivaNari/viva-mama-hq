import Lucide from "@react-native-vector-icons/lucide";
import { MaterialDesignIcons } from "@react-native-vector-icons/material-design-icons";
import { useRoute, useNavigation } from "@react-navigation/native";
import React, { useEffect } from "react";
import {
    ActivityIndicator,
    Dimensions,
    Image,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from "react-native";
import LinearGradient from "react-native-linear-gradient";
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
                        style={[ContentDetailsStyles.heading, globalStyles.fontBold]}
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


const { height } = Dimensions.get("window");

const ArticleDetails = () => {
    const route = useRoute<any>();
    const navigation = useNavigation();
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
        <SafeAreaView style={styles.safeArea}>
            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
            >
                {/* Hero Section */}
                <View style={styles.heroContainer}>
                    <Image
                        source={{ uri: article.featuredImage }}
                        style={styles.heroImage}
                        resizeMode="cover"
                    />
                    <LinearGradient
                        colors={['rgba(0,0,0,0.4)', 'transparent', 'rgba(0,0,0,0.8)']}
                        style={styles.imageOverlay}
                    >
                        {/* Header Actions */}
                        <View style={styles.headerRow}>
                            <TouchableOpacity
                                onPress={() => navigation.goBack()}
                                style={styles.iconCircle}
                            >
                                <Lucide name="chevron-left" size={24} color="#fff" />
                            </TouchableOpacity>
                        </View>
                    </LinearGradient>
                </View>

                {/* Content Container */}
                <View style={styles.contentWrapper}>
                    <Text style={[ContentDetailsStyles.title, globalStyles.fontBold, { marginBottom: 8 }]}>
                        {article.featuredTitle}
                    </Text>
                    <Text style={[ContentDetailsStyles.author, globalStyles.fontRegular, { marginBottom: 15 }]}>
                        {
                            article.reviewers.length > 0 && (
                                <>
                                    Reviewed by {article.reviewers.map((author) => author.name).join(", ")}
                                    {" "} | {" "}
                                </>
                            )
                        }
                        Written by {article.authors.map((author) => author.name).join(", ")}
                    </Text>

                    {/* Action Buttons */}
                    <View style={ContentDetailsStyles.actions}>
                        <TouchableOpacity
                            style={ContentDetailsStyles.iconButton}
                            onPress={() => {
                                const shareMessage = article.contentBody
                                    .filter(item => item.contentType !== ContentBodyTypeEnum.IMAGE)
                                    .map(item => item.body)
                                    .join('\n\n');
                                Share.open({
                                    title: article.featuredTitle,
                                    message: `${article.featuredTitle} \n\n ${shareMessage}`,
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

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },
    scrollContent: {
        paddingBottom: 40,
    },
    heroContainer: {
        width: '100%',
        height: height * 0.4,
        backgroundColor: '#f0f0f0',
    },
    heroImage: {
        width: '100%',
        height: '100%',
    },
    imageOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        justifyContent: 'space-between',
        padding: 20,
    },
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 10,
    },
    iconCircle: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(0,0,0,0.3)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    heroInfo: {
        marginBottom: 10,
    },
    badgeRow: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 2,
    },
    badge: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 15,
    },
    badgeText: {
        color: '#fff',
        fontSize: 10,
        textTransform: 'uppercase',
    },
    articleTitle: {
        fontSize: 26,
        color: '#fff',
        textShadowColor: 'rgba(0,0,0,0.5)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 4,
    },
    contentWrapper: {
        padding: 20,
        marginTop: -30,
        backgroundColor: '#fff',
        borderTopLeftRadius: 30,
        borderTopRightRadius: 30,
        flex: 1,
    },
});

export default ArticleDetails;


