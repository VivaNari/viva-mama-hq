import MaterialDesignIcons from "@react-native-vector-icons/material-design-icons"
import { View, Image, Text, TouchableOpacity } from "react-native"
import { colors } from "../../public/assets/colors"
import { globalStyles } from "../../public/styles"
import { IVivaClubPost } from "../../types/vivaClub.types"
import React, { useState, useEffect } from 'react'
import apiClientInterceptor from "../../api/apiClientInterceptor"
import { API_VIVA_CLUB_TOGGLE_LIKE } from "../../constants/endpoints"
import i18n from "../../i18n"
import ContentModerationButton from "./ContentModerationButton"
import { TContentAction } from "./ContentActionsMenu"

const FLVivaClubPostItem = ({
    isFromCommunityScreen = false,
    isFromDetials = false,
    bgColor = 'rgba(255, 250, 250, 1)',
    item,
    navigation,
    onModerated
}: {
    isFromCommunityScreen?: boolean,
    isFromDetials?: boolean,
    bgColor?: string,
    item: IVivaClubPost,
    navigation?: { navigate: any },
    /**
     * Refetch after a report, block or delete — the server decides visibility.
     * Receives the action so a caller showing only this post can leave the screen
     * when the post goes away, but stay put on a report, which does not hide it.
     */
    onModerated?: (action: TContentAction) => void
}) => {
    const [isLiked, setIsLiked] = useState(item.isLiked);
    const [likeCount, setLikeCount] = useState(item.totalLikes);

    // Sync state with props when the feed refreshes or props change
    useEffect(() => {
        setIsLiked(item.isLiked);
        setLikeCount(item.totalLikes);
    }, [item.isLiked, item.totalLikes]);

    const handleToggleLike = async () => {
        try {
            // Optimistic update
            const newIsLiked = !isLiked;
            setIsLiked(newIsLiked);
            setLikeCount(prev => newIsLiked ? prev + 1 : prev - 1);

            await apiClientInterceptor().post(API_VIVA_CLUB_TOGGLE_LIKE(item._id));
        } catch (error) {
            console.error("Failed to toggle like", error);
            // Rollback on error
            setIsLiked(item.isLiked);
            setLikeCount(item.totalLikes);
        }
    };

    // The detail screen shows one post at full size, so it gets a larger avatar and
    // body text than the same card packed into the feed.
    const avatarSize = isFromDetials ? 40 : 30;

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    return (
        <TouchableOpacity
            // On the detail screen the card is not a link to anywhere, so it should not
            // dim under a press either.
            activeOpacity={isFromDetials ? 1 : 0.9}
            onPress={() => !isFromDetials && navigation?.navigate("VivaClubPostDetails", { postId: item._id })}
            style={{
                backgroundColor: bgColor,
                padding: isFromDetials ? 0 : 10,
                marginVertical: 10,
                borderRadius: 5
            }}
        >
            {/* User Info */}
            <View
                style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                }}
            >
                {/* User Avatar and Name */}
                <View
                    style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 10
                    }}
                >
                    {item.user.profile_picture ? (
                        <Image
                            source={{ uri: item.user.profile_picture }}
                            style={{ height: avatarSize, width: avatarSize, borderRadius: avatarSize / 2 }}
                        />
                    ) : (
                        <View style={{ height: avatarSize, width: avatarSize, borderRadius: avatarSize / 2, backgroundColor: isFromDetials ? colors.lightPurple : colors.gray, justifyContent: 'center', alignItems: 'center' }}>
                            <Text style={[{ fontSize: isFromDetials ? 15 : 10, color: isFromDetials ? colors.darkPurple : colors.black }, globalStyles.fontSemiBold]}>
                                {(item.user.user_name?.charAt(0) ?? '?').toUpperCase()}
                            </Text>
                        </View>
                    )}
                    <Text
                        style={[{
                            fontSize: isFromDetials ? 14 : 12,
                            color: colors.text,
                        }, isFromDetials ? globalStyles.fontSemiBold : globalStyles.fontMedium]}
                    >
                        {item.user?.user_name ?? i18n.t('vivaClub.anonymous')}
                    </Text>
                </View>

                {/* Posted Date Time + moderation actions */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text
                        style={[{
                            fontSize: 10,
                            color: colors.darkGray
                        }, globalStyles.fontMedium]}
                    >
                        {formatDate(item.createdAt)}
                    </Text>
                    {/* Play's UGC policy requires reporting and blocking to be reachable
                        from the content itself, not buried in settings. */}
                    <ContentModerationButton
                        target={{
                            type: 'VIVA_CLUB_POST',
                            id: item._id,
                            authorId: item.user?._id,
                            isOwn: !!item.isOwn,
                        }}
                        onChanged={(action) => onModerated?.(action)}
                    />
                </View>
            </View>

            {/* Post Content */}
            <View style={{ marginVertical: 15 }}>
                <Text
                    style={[{
                        fontSize: isFromDetials ? 15 : 13,
                        color: isFromDetials ? colors.text : colors.black,
                        lineHeight: isFromDetials ? 23 : 18
                    }, globalStyles.fontRegular]}
                    numberOfLines={isFromCommunityScreen ? 3 : undefined}
                >
                    {item.content}
                </Text>
            </View>

            {/* Attached media. Only the detail view has the room to show it full width;
                the feed keeps its compact text-only rows. */}
            {isFromDetials && item.mediaUrls?.length ? (
                <View style={{ gap: 8, marginBottom: 15 }}>
                    {item.mediaUrls.map((url) => (
                        <Image
                            key={url}
                            source={{ uri: url }}
                            style={{
                                width: '100%',
                                height: 220,
                                borderRadius: 12,
                                backgroundColor: colors.lightGray,
                            }}
                            resizeMode='cover'
                        />
                    ))}
                </View>
            ) : null}

            {/* Like, Comment wrapper */}
            <View
                style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 30,
                    ...(isFromDetials ? {
                        borderTopWidth: 1,
                        borderTopColor: colors.border,
                        paddingTop: 12,
                    } : {}),
                }}
            >
                <TouchableOpacity
                    onPress={handleToggleLike}
                    style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 5
                    }}
                >
                    <MaterialDesignIcons
                        name={isLiked ? 'heart' : 'heart-outline'}
                        size={20}
                        color={isLiked ? 'rgba(255, 0, 94, 1)' : colors.darkGray}
                    />
                    <Text style={[{ fontSize: 12 }, globalStyles.fontRegular]}>
                        {likeCount}
                    </Text>
                </TouchableOpacity>

                <View
                    style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 5
                    }}
                >
                    <MaterialDesignIcons
                        name='comment-quote-outline'
                        size={20}
                        color={colors.darkGray}
                    />
                    <Text style={[{ fontSize: 12 }, globalStyles.fontRegular]}>
                        {item.commentCount || 0}
                    </Text>
                </View>
            </View>
        </TouchableOpacity>
    )
}

export default FLVivaClubPostItem;