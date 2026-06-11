import MaterialDesignIcons from "@react-native-vector-icons/material-design-icons"
import { View, Image, Text, TouchableOpacity } from "react-native"
import { colors } from "../../public/assets/colors"
import { globalStyles } from "../../public/styles"
import { IVivaClubPost } from "../../types/vivaClub.types"
import React, { useState, useEffect } from 'react'
import apiClientInterceptor from "../../api/apiClientInterceptor"
import { API_VIVA_CLUB_TOGGLE_LIKE } from "../../constants/endpoints"

const FLVivaClubPostItem = ({
    isFromCommunityScreen = false,
    isFromDetials = false,
    bgColor = 'rgba(255, 250, 250, 1)',
    item,
    navigation
}: {
    isFromCommunityScreen?: boolean,
    isFromDetials?: boolean,
    bgColor?: string,
    item: IVivaClubPost,
    navigation?: { navigate: any }
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
            activeOpacity={0.9}
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
                            style={{ height: 30, width: 30, borderRadius: 15 }}
                        />
                    ) : (
                        <View style={{ height: 30, width: 30, borderRadius: 15, backgroundColor: colors.gray, justifyContent: 'center', alignItems: 'center' }}>
                            <Text style={{ fontSize: 10 }}>{item.user.user_name?.charAt(0)}</Text>
                        </View>
                    )}
                    <Text
                        style={[{
                            fontSize: 12,
                        }, globalStyles.fontMedium]}
                    >
                        {item.user.user_name}
                    </Text>
                </View>

                {/* Posted Date Time */}
                <Text
                    style={[{
                        fontSize: 10,
                        color: colors.darkGray
                    }, globalStyles.fontMedium]}
                >
                    {formatDate(item.createdAt)}
                </Text>
            </View>
            
            {/* Post Content */}
            <View style={{ marginVertical: 15 }}>
                <Text
                    style={[{
                        fontSize: 13,
                        color: colors.black,
                        lineHeight: 18
                    }, globalStyles.fontRegular]}
                    numberOfLines={isFromCommunityScreen ? 3 : undefined}
                >
                    {item.content}
                </Text>
            </View>

            {/* Like, Comment wrapper */}
            <View
                style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 30
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