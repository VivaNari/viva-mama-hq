import Lucide from '@react-native-vector-icons/lucide';
import { useNavigation, useRoute } from '@react-navigation/native';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    ActivityIndicator,
    FlatList,
    Image,
    Keyboard,
    KeyboardAvoidingView,
    Platform,
    RefreshControl,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import apiClientInterceptor from '../api/apiClientInterceptor';
import FLVivaClubPostItem from '../components/vivaClub/FLVivaClubPostItem';
import ContentModerationButton from '../components/vivaClub/ContentModerationButton';
import CommunityGuidelinesGate from '../components/vivaClub/CommunityGuidelinesGate';
import { getGuidelinesStatus } from '../api/vivaClubModeration';
import { API_VIVA_CLUB_ADD_COMMENT, API_VIVA_CLUB_POST_DETAILS } from '../constants/endpoints';
import { colors } from '../public/assets/colors';
import { globalStyles } from '../public/styles';
import { IComment, IVivaClubPost } from '../types/vivaClub.types';
import { AnalyticsEvent, recordError, track } from '../analytics';

const AVATAR_TINTS = [colors.lightPurple, '#FFE3EC', '#E2F4EA', '#FFF1D6', '#E4EEFF'];

/** Stable per-user tint, so the same commenter keeps the same avatar colour. */
const avatarTint = (seed: string = '') => {
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
        hash = (hash + seed.charCodeAt(i)) % AVATAR_TINTS.length;
    }
    return AVATAR_TINTS[hash];
};

const Avatar = ({ user, size }: { user: IComment['user']; size: number }) => {
    if (user?.profile_picture) {
        return (
            <Image
                source={{ uri: user.profile_picture }}
                style={{ height: size, width: size, borderRadius: size / 2 }}
            />
        );
    }
    return (
        <View
            style={{
                height: size,
                width: size,
                borderRadius: size / 2,
                backgroundColor: avatarTint(user?.user_name),
                justifyContent: 'center',
                alignItems: 'center',
            }}
        >
            <Text style={[globalStyles.fontSemiBold, { fontSize: size * 0.4, color: colors.darkPurple }]}>
                {(user?.user_name?.charAt(0) ?? '?').toUpperCase()}
            </Text>
        </View>
    );
};

const VivaClubPostDetails = () => {
    const { t } = useTranslation();
    const navigation = useNavigation<any>();
    const route = useRoute<any>();
    const { postId } = route.params;

    const [post, setPost] = useState<IVivaClubPost | null>(null);
    const [commentText, setCommentText] = useState("");
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [commenting, setCommenting] = useState(false);
    const [needsGuidelines, setNeedsGuidelines] = useState(false);
    const [showGuidelines, setShowGuidelines] = useState(false);
    const [isKeyboardVisible, setKeyboardVisible] = useState(false);

    useEffect(() => {
        const showSubscription = Keyboard.addListener('keyboardDidShow', () => {
            setKeyboardVisible(true);
        });
        const hideSubscription = Keyboard.addListener('keyboardDidHide', () => {
            setKeyboardVisible(false);
        });

        return () => {
            showSubscription.remove();
            hideSubscription.remove();
        };
    }, []);

    // Memoised because renderComment depends on it. Left as a plain function it was a
    // new reference every render, which silently defeated renderComment's useCallback
    // and re-rendered every comment row on any state change.
    const fetchPostDetails = useCallback(async () => {
        try {
            const { data } = await apiClientInterceptor().get(API_VIVA_CLUB_POST_DETAILS(postId));
            setPost(data.data);
            track(AnalyticsEvent.COMMUNITY_POST_OPENED, { post_id: postId });
        } catch (error) {
            console.error("Failed to fetch post details", error);
            Toast.show({ type: 'error', text1: t('common.error'), text2: t('vivaClub.loadFailed') });
            recordError(error, 'VivaClubPostDetails.fetchPostDetails', {
                post_id: postId,
            });
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [postId, t]);

    useEffect(() => {
        fetchPostDetails();
    }, [fetchPostDetails]);

    // Checked on mount so the sheet can be shown before anything is typed. A failed
    // check must not block commenting: the server gates it anyway and answers
    // GUIDELINES_NOT_ACCEPTED if acceptance really is still required.
    useEffect(() => {
        (async () => {
            try {
                const status = await getGuidelinesStatus();
                setNeedsGuidelines(!status.accepted);
            } catch (error) {
                recordError(error, 'VivaClubPostDetails.guidelinesStatus');
            }
        })();
    }, []);

    const handleRefresh = () => {
        setRefreshing(true);
        fetchPostDetails();
    };

    /**
     * Commenting is gated on the community guidelines exactly as posting is — a comment
     * is content, and the UGC policy asks for acceptance before content is created.
     * Whichever the user reaches first shows the sheet; one acceptance covers both.
     *
     * `skipGuidelinesCheck` is the same stale-closure guard as CreatePost.publish():
     * the accept handler sets the flag and calls straight through in the same tick, so
     * this call still closes over the old `true` and would re-open the sheet it was
     * just dismissed from. Passing the fact is what breaks the cycle.
     */
    const handleAddComment = async (skipGuidelinesCheck = false) => {
        if (!commentText.trim()) return;

        if (needsGuidelines && !skipGuidelinesCheck) {
            setShowGuidelines(true);
            return;
        }

        try {
            setCommenting(true);
            await apiClientInterceptor().post(API_VIVA_CLUB_ADD_COMMENT(postId), {
                content: commentText
            });
            setCommentText("");
            fetchPostDetails(); // Refresh comments
        } catch (error) {
            console.error("Failed to add comment", error);
            const denial = (error as any)?.response?.data?.data?.code;

            // The server is the authority. The mount-time check can miss on a network
            // blip, and without this the refusal is a dead end with no route to the sheet.
            if (denial === 'GUIDELINES_NOT_ACCEPTED') {
                setNeedsGuidelines(true);
                setShowGuidelines(true);
                return;
            }

            Toast.show({
                type: 'error',
                text1: t('common.error'),
                text2: denial === 'COMMUNITY_BANNED'
                    ? t('vivaClub.bannedNotice')
                    : t('vivaClub.commentFailed')
            });
        } finally {
            setCommenting(false);
        }
    };

    // Comments are mostly minutes-to-days old, where "3h ago" reads faster than a full
    // timestamp; anything older falls back to a plain date.
    const formatRelativeTime = useCallback((dateString: string) => {
        const minutes = Math.floor((Date.now() - new Date(dateString).getTime()) / 60000);
        if (minutes < 1) return t('common.time.justNow');
        if (minutes < 60) return t('common.time.minutesAgo', { count: minutes });
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return t('common.time.hoursAgo', { count: hours });
        const days = Math.floor(hours / 24);
        if (days < 7) return t('common.time.daysAgo', { count: days });
        return new Date(dateString).toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
        });
    }, [t]);

    const renderComment = useCallback(({ item }: { item: IComment }) => (
        <View style={styles.commentRow}>
            <Avatar user={item.user} size={34} />
            <View style={styles.commentBubble}>
                <View style={styles.commentMetaRow}>
                    <Text style={[globalStyles.fontSemiBold, styles.commentAuthor]} numberOfLines={1}>
                        {item.user?.user_name ?? t('vivaClub.anonymous')}
                    </Text>
                    <Text style={[globalStyles.fontRegular, styles.commentTime]}>
                        {formatRelativeTime(item.createdAt)}
                    </Text>
                    {/* Comments need their own report/block/delete affordance: the
                        policy is about objectionable content, and a comment is as
                        capable of being objectionable as the post above it. */}
                    <ContentModerationButton
                        size={16}
                        target={{
                            type: 'VIVA_CLUB_COMMENT',
                            id: item._id,
                            authorId: item.user?._id,
                            isOwn: !!item.isOwn,
                            postId,
                        }}
                        onChanged={fetchPostDetails}
                    />
                </View>
                <Text style={[globalStyles.fontRegular, styles.commentText]}>
                    {item.content}
                </Text>
            </View>
        </View>
    ), [formatRelativeTime, t, postId, fetchPostDetails]);

    const canSend = !!commentText.trim() && !commenting;

    return (
        <SafeAreaView style={styles.safeArea}>
            <CommunityGuidelinesGate
                visible={showGuidelines}
                onAccepted={() => {
                    setNeedsGuidelines(false);
                    setShowGuidelines(false);
                    // Straight through to posting the comment the user already typed and
                    // sent. The flag is passed, not read back from state — see
                    // handleAddComment().
                    handleAddComment(true);
                }}
                onDismiss={() => setShowGuidelines(false)}
            />
            <KeyboardAvoidingView
                behavior={isKeyboardVisible ? 'padding' : undefined}
                style={{ flex: 1 }}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
                enabled={true}
            >
                {/* In-screen header, like ChatWithVivaAI: the native-stack header is turned off
                    for this route so the KeyboardAvoidingView measures from the top of the
                    window instead of from below a header it cannot account for. */}
                <View style={styles.header}>
                    <TouchableOpacity
                        style={styles.backButton}
                        onPress={() => navigation.goBack()}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                        <Lucide name='arrow-left' size={22} color={colors.darkPurple} />
                    </TouchableOpacity>
                    <Text style={[globalStyles.fontSemiBold, styles.headerTitle]} numberOfLines={1}>
                        {t('nav.vivaClubPost')}
                    </Text>
                    {/* Mirrors the back button's width so the title stays optically centred. */}
                    <View style={styles.backButtonSpacer} />
                </View>

                {loading ? (
                    <View style={styles.loadingWrap}>
                        <ActivityIndicator size="large" color={colors.darkPurple} />
                    </View>
                ) : (
                    <FlatList
                        keyExtractor={(item) => item._id}
                        data={post?.comments}
                        renderItem={renderComment}
                        style={{ flex: 1 }}
                        contentContainerStyle={styles.listContent}
                        showsVerticalScrollIndicator={false}
                        keyboardShouldPersistTaps="handled"
                        keyboardDismissMode="on-drag"
                        refreshControl={
                            <RefreshControl
                                refreshing={refreshing}
                                onRefresh={handleRefresh}
                                tintColor={colors.darkPurple}
                                colors={[colors.darkPurple]}
                            />
                        }
                        ListHeaderComponent={
                            <View>
                                <View style={styles.postCard}>
                                    {post && (
                                        <FLVivaClubPostItem
                                            isFromDetials={true}
                                            bgColor="transparent"
                                            item={post}
                                            // Deleting the post, or blocking its author,
                                            // leaves nothing here to show — the server
                                            // will 404 the next fetch — so leave. A
                                            // report does not hide anything yet, so
                                            // stay and refresh instead: being thrown
                                            // out of the thread reads as the post
                                            // having been taken down when it has not.
                                            onModerated={(action) =>
                                                action === 'REPORT'
                                                    ? fetchPostDetails()
                                                    : navigation.goBack()
                                            }
                                        />
                                    )}
                                </View>

                                <View style={styles.commentsHeading}>
                                    <Lucide name='message-circle' size={16} color={colors.darkPurple} />
                                    <Text style={[globalStyles.fontSemiBold, styles.commentsHeadingText]}>
                                        {t('vivaClub.commentsCount', { count: post?.commentCount || 0 })}
                                    </Text>
                                </View>
                            </View>
                        }
                        ListEmptyComponent={
                            <View style={styles.emptyWrap}>
                                <View style={styles.emptyIconCircle}>
                                    <Lucide name='message-circle-dashed' size={26} color={colors.purple} />
                                </View>
                                <Text style={[globalStyles.fontSemiBold, styles.emptyTitle]}>
                                    {t('vivaClub.noComments')}
                                </Text>
                                <Text style={[globalStyles.fontRegular, styles.emptySubtitle]}>
                                    {t('vivaClub.beFirstToComment')}
                                </Text>
                            </View>
                        }
                    />
                )}

                <View style={styles.inputBar}>
                    <View style={styles.inputPill}>
                        <TextInput
                            style={[globalStyles.fontRegular, styles.textInput]}
                            placeholder={t('vivaClub.writeComment')}
                            placeholderTextColor={colors.gray}
                            value={commentText}
                            onChangeText={setCommentText}
                            multiline
                            maxLength={1000}
                        />
                    </View>
                    <TouchableOpacity
                        activeOpacity={0.85}
                        onPress={() => handleAddComment()}
                        disabled={!canSend}
                    >
                        <LinearGradient
                            colors={canSend
                                ? [colors.darkPurple, colors.purple]
                                : [colors.mediumGray, colors.mediumGray]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={styles.sendButton}
                        >
                            {commenting ? (
                                <ActivityIndicator size="small" color={colors.white} />
                            ) : (
                                <Lucide name='send-horizontal' size={18} color={colors.white} />
                            )}
                        </LinearGradient>
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    )
}

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: colors.pageBG,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 12,
        paddingVertical: 10,
        backgroundColor: colors.white,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    backButton: {
        height: 36,
        width: 36,
        borderRadius: 18,
        backgroundColor: colors.lightPurple,
        justifyContent: 'center',
        alignItems: 'center',
    },
    backButtonSpacer: {
        height: 36,
        width: 36,
    },
    headerTitle: {
        flex: 1,
        fontSize: 16,
        color: colors.text,
        textAlign: 'center',
    },
    loadingWrap: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    listContent: {
        padding: 14,
        paddingBottom: 20,
        flexGrow: 1,
    },
    postCard: {
        backgroundColor: colors.white,
        borderRadius: 16,
        paddingHorizontal: 16,
        paddingVertical: 4,
        borderWidth: 1,
        borderColor: colors.border,
        // Lifts the post off the grey page so it reads as the subject of the screen,
        // with the comments below it as replies to it.
        shadowColor: colors.black,
        shadowOpacity: 0.05,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 2 },
        elevation: 2,
    },
    commentsHeading: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: 22,
        marginBottom: 6,
    },
    commentsHeadingText: {
        fontSize: 14,
        color: colors.text,
    },
    commentRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 10,
        marginTop: 12,
    },
    commentBubble: {
        flex: 1,
        backgroundColor: colors.white,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 14,
        borderTopLeftRadius: 4,
        paddingHorizontal: 12,
        paddingVertical: 10,
    },
    commentMetaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
        marginBottom: 4,
    },
    commentAuthor: {
        flex: 1,
        fontSize: 12.5,
        color: colors.darkPurple,
    },
    commentTime: {
        fontSize: 10.5,
        color: colors.gray,
    },
    commentText: {
        fontSize: 13.5,
        lineHeight: 20,
        color: colors.text,
    },
    emptyWrap: {
        alignItems: 'center',
        paddingTop: 26,
        paddingHorizontal: 30,
    },
    emptyIconCircle: {
        height: 54,
        width: 54,
        borderRadius: 27,
        backgroundColor: colors.lightPurple,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 12,
    },
    emptyTitle: {
        fontSize: 14,
        color: colors.text,
    },
    emptySubtitle: {
        fontSize: 12,
        color: colors.darkGray,
        textAlign: 'center',
        marginTop: 4,
        lineHeight: 18,
    },
    inputBar: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        gap: 10,
        paddingHorizontal: 12,
        paddingVertical: 10,
        backgroundColor: colors.white,
        borderTopWidth: 1,
        borderTopColor: colors.border,
    },
    inputPill: {
        flex: 1,
        backgroundColor: colors.pageBG,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 22,
        paddingHorizontal: 16,
        justifyContent: 'center',
    },
    textInput: {
        fontSize: 14,
        color: colors.text,
        // Caps growth at roughly five lines so a long comment scrolls inside the pill
        // instead of pushing the send button off screen.
        maxHeight: 110,
        minHeight: 42,
        paddingTop: Platform.OS === 'ios' ? 12 : 8,
        paddingBottom: Platform.OS === 'ios' ? 12 : 8,
    },
    sendButton: {
        height: 44,
        width: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
    },
});

export default VivaClubPostDetails
