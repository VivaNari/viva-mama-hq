import { useRoute } from '@react-navigation/native';
import React, { useEffect, useState } from 'react';
import { FlatList, Image, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import FLVivaClubPostItem from '../components/vivaClub/FLVivaClubPostItem';
import { vivaClubData } from '../data/vivaClubData';
import { colors } from '../public/assets/colors';
import { globalStyles } from '../public/styles';
import { IComment, IVivaClubPost } from '../types/vivaClub.types';
import GradientButtonWithSlightRadius from '../components/GradientButtonWithSlightRadius';
import LinearGradient from 'react-native-linear-gradient';
import { styles } from '../public/styles/chatWithVivaAiStyles';
import MaterialDesignIcons from '@react-native-vector-icons/material-design-icons';

const FlRenderComments = ({ item }: { item: IComment }) => {
    return (
        <View
            style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
                marginVertical: 8,
                marginRight: '25%'
            }}
        >
            <Image
                source={item.user.avatar}
                style={{
                    height: 25,
                    width: 25,
                    borderRadius: 30,
                    objectFit: 'cover'
                }}
            />
            <LinearGradient
                colors={[colors.darkPurple, colors.purple]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={{
                    borderRadius: 10,
                    justifyContent: "center",
                    alignItems: "flex-start",
                    paddingVertical: 10,
                    paddingHorizontal: 10,
                    marginTop: 10,
                    flexShrink: 1
                }}
            >
                <Text
                    style={[{
                        color: colors.white,
                        fontSize: 13,
                    }, globalStyles.fontRegular]}
                >
                    {item.content}
                </Text>
            </LinearGradient>
        </View>
    )
}

const VivaClubPostDetails = () => {
    const route = useRoute<any>();
    const { postId } = route.params;

    const post: IVivaClubPost | undefined = vivaClubData.find((item) => item.id === postId);

    const [getPostData, setPostData] = useState<IVivaClubPost>();

    useEffect(() => {
        post && setPostData(post)
    }, [])

    return (
        <SafeAreaView
            style={{ flex: 1 }}
        >
            {/* Comments */}
            <View
                style={[globalStyles.container, { paddingVertical: 5 }]}
            >

                <FlatList
                    keyExtractor={(_, index) => index.toString()}
                    data={post?.comments}
                    renderItem={FlRenderComments}
                    ListHeaderComponent={() => (
                        <View>
                            <View
                                style={{
                                    borderBottomWidth: 1,
                                    borderBottomColor: colors.gray,
                                    paddingBottom: 20
                                }}
                            >
                                {
                                    getPostData && <FLVivaClubPostItem
                                        isFromDetials={true}
                                        bgColor="transparent"
                                        item={getPostData}
                                    />
                                }
                            </View>
                            <Text
                                style={[{
                                    fontSize: 14,
                                    marginTop: 20
                                }, globalStyles.fontMedium]}
                            >
                                Comments
                            </Text>
                        </View>
                    )}
                />
            </View>

            {/* add Comment box */}
            <View style={[styles.inputContainer]}>
                <TextInput
                    style={[styles.textInput, globalStyles.fontRegular]}
                    placeholder="Write a comment..."
                    placeholderTextColor={colors.darkGray}
                />
                <TouchableOpacity
                    style={styles.sendButton}
                    onPress={() => { }}
                >
                    <MaterialDesignIcons
                        name='send-outline'
                        size={20}
                        color={colors.white}
                        style={{
                            transform: [{ rotate: '-35deg' }]
                        }}
                    />
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    )
}

export default VivaClubPostDetails