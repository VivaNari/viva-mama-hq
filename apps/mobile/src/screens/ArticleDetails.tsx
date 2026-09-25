import Lucide from "@react-native-vector-icons/lucide";
import { MaterialDesignIcons } from "@react-native-vector-icons/material-design-icons";
import { useRoute, useNavigation } from "@react-navigation/native";
import React, { useEffect } from "react";
import { useTranslation } from "react-i18next";
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
import { AnalyticsEvent, dwellBucket, recordError, track } from "../analytics";
import { useLanguage } from "../context/LanguageContext";
import { colors } from "../public/assets/colors.ts";
import { globalStyles } from "../public/styles";
import { ContentDetailsStyles } from "../public/styles/contentStyles";
import { ContentBodyTypeEnum, IUserContent, IUserContentresponse } from "../types/content.types.ts";
import YoutubePlayer from 'react-native-youtube-iframe';


const extractYoutubeVideoId = (url: string) => {
    const regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[7].length === 11) ? match[7] : null;
};

const ArticleVideo = ({ url }: { url: string }) => {
    const [playing, setPlaying] = React.useState(false);
    const videoId = extractYoutubeVideoId(url);

    const onStateChange = React.useCallback((state: string) => {
        if (state === "ended") {
            setPlaying(false);
            track(AnalyticsEvent.VIDEO_COMPLETED, { content_id: videoId ?? url });
        } else if (state === "playing") {
            track(AnalyticsEvent.VIDEO_STARTED, { content_id: videoId ?? url });
        }
    }, [videoId, url]);

    if (!videoId) return null;

    return (
        <View style={{ height: 220, marginVertical: 20, borderRadius: 10, overflow: 'hidden' }}>
            <YoutubePlayer
                height={220}
                play={playing}
                videoId={videoId}
                onChangeState={onStateChange}
            />
        </View>
    );
};

const renderContentBody = (article: IUserContent) => {
    if (!article?.contentBody?.length) return null;


    return article.contentBody.map((item, index) => {
        const key = item._id || `body-${index}`;
        switch (item.contentType) {
            case ContentBodyTypeEnum.HEADING:
                return (
                    <Text
                        key={key}
                        style={[ContentDetailsStyles.heading, globalStyles.fontBold]}
                    >
                        {item.body}
                    </Text>
                );

            case ContentBodyTypeEnum.SUBHEADING:
                return (
                    <Text
                        key={key}
                        style={[ContentDetailsStyles.subHeading, globalStyles.fontMedium]}
                    >
                        {item.body}
                    </Text>
                );

            case ContentBodyTypeEnum.PARAGRAPH:
                return (
                    <Text
                        key={key}
                        style={[ContentDetailsStyles.content, globalStyles.fontRegular]}
                    >
                        {item.body}
                    </Text>
                );

            case ContentBodyTypeEnum.VIDEO:
                return (
                    <View key={key} style={{ height: 220, marginBottom: 20, borderRadius: 10, overflow: 'hidden' }}>
                        <ArticleVideo url={item.body} />
                    </View>

                );

            default:
                return null;
        }
    });
};


const { height } = Dimensions.get("window");

const ArticleDetails = () => {
    const { t } = useTranslation();
    const { language } = useLanguage();
    const route = useRoute<any>();
    const navigation = useNavigation();
    const { articleId } = route.params;
    const [article, setArticle] = React.useState<IUserContent | null>(null);
    const [loading, setLoading] = React.useState<boolean>(false);

    useEffect(() => {
        (async () => {
            setLoading(true);
            try {
                const getContentById: IUserContentresponse = await getUserContentById(articleId);
                setArticle(getContentById.data);
                track(AnalyticsEvent.ARTICLE_OPENED, { article_id: articleId });
            } catch (error) {
                // Previously uncaught: the spinner never cleared and the user was
                // stuck on a loading screen with no way to know it had failed.
                recordError(error, 'ArticleDetails.getUserContentById', {
                    article_id: articleId,
                });
            } finally {
                setLoading(false);
            }
        })()
    }, [articleId, language])

    /**
     * How long the article was actually open, reported on the way out.
     *
     * Bucketed rather than exact — the question worth answering is "did anyone
     * read this or bounce off it", and a precise dwell time on a specific health
     * article is more identifying than it is useful.
     */
    useEffect(() => {
        const openedAt = Date.now();
        return () => {
            track(AnalyticsEvent.ARTICLE_READ_COMPLETED, {
                article_id: articleId,
                dwell_bucket: dwellBucket(Date.now() - openedAt),
            });
        };
    }, [articleId]);

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
                    {t('articleDetails.notFound')}
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
                    {
                        (article.authors.length > 0 || article.reviewers?.length > 0) && (

                            <Text style={[ContentDetailsStyles.author, globalStyles.fontRegular, { marginBottom: 15 }]}>
                                {
                                    article.reviewers.length > 0 && (
                                        <>
                                            {t('articleDetails.reviewedBy', { names: article.reviewers.map((author) => author.name).join(", ") })}
                                            {" "} | {" "}
                                        </>
                                    )
                                }
                                {
                                    article.authors.length > 0 && (
                                        <>
                                            {t('articleDetails.writtenBy', { names: article.authors.map((author) => author.name).join(", ") })}
                                        </>
                                    )
                                }
                            </Text>
                        )
                    }

                    {/* Action Buttons */}
                    <View style={ContentDetailsStyles.actions}>
                        <TouchableOpacity
                            style={ContentDetailsStyles.iconButton}
                            onPress={() => {
                                // contentBody is absent on locked articles — the server
                                // strips it rather than trusting the UI to hide it.
                                const shareMessage = (article.contentBody ?? [])
                                    .filter(item => item.contentType !== ContentBodyTypeEnum.IMAGE)
                                    .map(item => item.body)
                                    .join('\n\n');
                                Share.open({
                                    title: article.featuredTitle,
                                    message: `${article.featuredTitle} \n\n ${shareMessage}`,
                                })
                                    .then((res) => {
                                        console.log(res);
                                        // The sheet resolves on dismissal too, flagged by
                                        // `dismissedAction` — so tracking every resolve
                                        // would count abandoned taps as shares. There is
                                        // no target-app field on the result, hence no
                                        // `method`.
                                        if (res?.dismissedAction) return;
                                        track(AnalyticsEvent.SHARE, {
                                            content_type: 'article',
                                            item_id: articleId,
                                        });
                                    })
                                    .catch((err) => {
                                        err && console.log(err);
                                    });
                            }}
                        >
                            <MaterialDesignIcons name="share-variant" size={22} color="#333" />
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


