import { useRoute } from '@react-navigation/native';
import React, { useEffect, useState } from 'react';
import { FlatList, Image, ScrollView, Text, TextInput, TouchableOpacity, View, ActivityIndicator, KeyboardAvoidingView, Keyboard, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import FLVivaClubPostItem from '../components/vivaClub/FLVivaClubPostItem';
import { colors } from '../public/assets/colors';
import { globalStyles } from '../public/styles';
import { IComment, IVivaClubPost } from '../types/vivaClub.types';
import LinearGradient from 'react-native-linear-gradient';
import { styles } from '../public/styles/chatWithVivaAiStyles';
import MaterialDesignIcons from '@react-native-vector-icons/material-design-icons';
import apiClientInterceptor from '../api/apiClientInterceptor';
import { API_VIVA_CLUB_POST_DETAILS, API_VIVA_CLUB_ADD_COMMENT } from '../constants/endpoints';
import Toast from 'react-native-toast-message';

const FlRenderComments = ({ item }: { item: IComment }) => {
    return (
        <View
            style={{
                flexDirection: 'row',
                alignItems: 'flex-start',
                gap: 8,
                marginVertical: 8,
                marginRight: '15%'
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
            <View style={{ flex: 1 }}>
                <Text style={[globalStyles.fontSemiBold, { fontSize: 12, color: colors.darkPurple }]}>{item.user.user_name}</Text>
                <LinearGradient
                    colors={[colors.darkPurple, colors.purple]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={{
                        borderRadius: 10,
                        paddingVertical: 8,
                        paddingHorizontal: 12,
                        marginTop: 4,
                    }}
                >
                    <Text style={[{ color: colors.white, fontSize: 13 }, globalStyles.fontRegular]}>
                        {item.content}
                    </Text>
                </LinearGradient>
            </View>
        </View>
    )
}

const VivaClubPostDetails = () => {
    const route = useRoute<any>();
    const { postId } = route.params;

    const [post, setPost] = useState<IVivaClubPost | null>(null);
    const [commentText, setCommentText] = useState("");
    const [loading, setLoading] = useState(true);
    const [commenting, setCommenting] = useState(false);
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

    const fetchPostDetails = async () => {
        try {
            const { data } = await apiClientInterceptor().get(API_VIVA_CLUB_POST_DETAILS(postId));
            setPost(data.data);
        } catch (error) {
            console.error("Failed to fetch post details", error);
            Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to load post details' });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPostDetails();
    }, [postId]);

    const handleAddComment = async () => {
        if (!commentText.trim()) return;
        try {
            setCommenting(true);
            await apiClientInterceptor().post(API_VIVA_CLUB_ADD_COMMENT(postId), {
                content: commentText
            });
            setCommentText("");
            fetchPostDetails(); // Refresh comments
        } catch (error) {
            console.error("Failed to add comment", error);
            Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to add comment' });
        } finally {
            setCommenting(false);
        }
    };

    if (loading) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                <ActivityIndicator size="large" color={colors.darkPurple} />
            </View>
        );
    }

    return (
        <SafeAreaView style={{ flex: 1 }}>
            <KeyboardAvoidingView
                behavior={isKeyboardVisible ? 'padding' : undefined}
                style={{ flex: 1 }}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
                enabled={true}
            >
            <View style={[globalStyles.container, { paddingVertical: 5, flex: 1 }]}>
                <FlatList
                    keyExtractor={(item) => item._id}
                    data={post?.comments}
                    renderItem={FlRenderComments}
                    ListHeaderComponent={() => (
                        <View>
                            <View style={{ borderBottomWidth: 1, borderBottomColor: colors.gray, paddingBottom: 20 }}>
                                {post && <FLVivaClubPostItem isFromDetials={true} bgColor="transparent" item={post} />}
                            </View>
                            <Text style={[{ fontSize: 14, marginTop: 20, color: colors.black }, globalStyles.fontMedium]}>
                                Comments ({post?.commentCount || 0})
                            </Text>
                        </View>
                    )}
                    ListEmptyComponent={() => !loading && <Text style={[globalStyles.fontRegular, { textAlign: 'center', marginTop: 20 }]}>No comments yet.</Text>}
                />
            </View>

            <View style={[styles.inputContainer, { backgroundColor: colors.white, borderTopWidth: 1, borderTopColor: colors.gray }]}>
                <TextInput
                    style={[styles.textInput, globalStyles.fontRegular, { color: colors.black }]}
                    placeholder="Write a comment..."
                    placeholderTextColor={colors.darkGray}
                    value={commentText}
                    onChangeText={setCommentText}
                    multiline
                />
                <TouchableOpacity
                    style={[styles.sendButton, { opacity: commenting || !commentText.trim() ? 0.5 : 1 }]}
                    onPress={handleAddComment}
                    disabled={commenting || !commentText.trim()}
                >
                    {commenting ? (
                        <ActivityIndicator size="small" color={colors.white} />
                    ) : (
                        <MaterialDesignIcons
                            name='send'
                            size={20}
                            color={colors.white}
                        />
                    )}
                </TouchableOpacity>
            </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    )
}

export default VivaClubPostDetails