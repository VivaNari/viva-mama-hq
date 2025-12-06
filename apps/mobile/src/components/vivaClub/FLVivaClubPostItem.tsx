import MaterialDesignIcons from "@react-native-vector-icons/material-design-icons"
import { View, Image, Text } from "react-native"
import { colors } from "../../public/assets/colors"
import { globalStyles } from "../../public/styles"
import { IVivaClubPost } from "../../types/vivaClub.types"

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
    return (
        <View
            onTouchEnd={() => navigation?.navigate("VivaClubPostDetails", { postId: item.id })}
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
                    <Image
                        source={item.user.avatar}
                        style={{
                            height: 30,
                            width: 30,
                            borderRadius: 30,
                            objectFit: 'cover'
                        }}
                    />
                    <Text
                        style={[{
                            fontSize: 12,

                        }, globalStyles.fontMedium]}
                    >
                        {item.user.name}
                    </Text>
                </View>

                {/* Posted Date Time */}
                <Text
                    style={[{
                        fontSize: 12,
                        color: colors.darkGray
                    }, globalStyles.fontMedium]}
                >
                    {item.publishedDateTime}
                </Text>
            </View>
            {/* Post Content */}
            <View
                style={{
                    marginVertical: 15
                }}
            >
                <Text
                    style={[{
                        fontSize: 12,
                        color: colors.primary
                    }, globalStyles.fontRegular]}
                    numberOfLines={isFromCommunityScreen ? 2 : undefined}
                >
                    {item.content}
                </Text>
            </View>
            {/* Like, Bookmark, Comment wrapper */}
            <View
                style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 30
                }}
            >
                <View
                    style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 5
                    }}
                >
                    {
                        item.isLiked ? (
                            <MaterialDesignIcons
                                name='heart'
                                size={20}
                                color={'rgba(255, 0, 94, 1)'}
                            />

                        ) : (
                            <MaterialDesignIcons
                                name='heart-outline'
                                size={20}
                                color={'rgba(255, 0, 94, 1)'}
                            />
                        )
                    }
                    <Text
                        style={[{
                            fontSize: 12
                        }, globalStyles.fontRegular]}
                    >
                        {item.totalLikes}
                    </Text>
                </View>
                <View
                    style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 5
                    }}
                >
                    {
                        <MaterialDesignIcons
                            name='comment-quote-outline'
                            size={20}
                            color={colors.darkGray}
                        />
                    }
                    <Text
                        style={[{
                            fontSize: 12
                        }, globalStyles.fontRegular]}
                    >
                        {item.comments.length.toString()}
                    </Text>
                </View>
                <View
                    style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 5
                    }}
                >
                    {
                        item.isBookMarked ? (
                            <MaterialDesignIcons
                                name='bookmark'
                                size={20}
                                color={colors.darkGray}
                            />
                        ) : (
                            <MaterialDesignIcons
                                name='bookmark-plus-outline'
                                size={20}
                                color={colors.darkGray}
                            />
                        )
                    }
                </View>
            </View>
        </View>
    )
}

export default FLVivaClubPostItem;