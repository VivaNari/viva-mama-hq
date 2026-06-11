import React, { useEffect, useState, useCallback } from 'react'
import { FlatList, Text, ActivityIndicator, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import FLVivaClubPostItem from '../components/vivaClub/FLVivaClubPostItem'
import { globalStyles } from '../public/styles'
import LinearGradient from 'react-native-linear-gradient'
import MaterialDesignIcons from '@react-native-vector-icons/material-design-icons'
import { colors } from '../public/assets/colors'
import apiClientInterceptor from '../api/apiClientInterceptor'
import { API_VIVA_CLUB_POSTS } from '../constants/endpoints'
import { IVivaClubPost } from '../types/vivaClub.types'
import { useFocusEffect, useNavigation } from '@react-navigation/native'

const VivaClubPost = () => {
    const navigation = useNavigation<any>();
    const [posts, setPosts] = useState<IVivaClubPost[]>([]);
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);

    const fetchPosts = async (pageNum: number, isRefresh = false) => {
        if (loading) return;
        try {
            setLoading(true);
            const { data } = await apiClientInterceptor().get(`${API_VIVA_CLUB_POSTS}?page=${pageNum}&limit=10`);
            const newPosts = data.data.posts;

            if (isRefresh) {
                setPosts(newPosts);
            } else {
                setPosts(prev => [...prev, ...newPosts]);
            }

            setHasMore(pageNum < data.data.pagination.totalPages);
        } catch (error) {
            console.error("Failed to fetch posts", error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useFocusEffect(
        useCallback(() => {
            fetchPosts(1, true);
            setPage(1);
        }, [])
    );

    const handleRefresh = () => {
        setRefreshing(true);
        setPage(1);
        fetchPosts(1, true);
    };

    const handleLoadMore = () => {
        if (hasMore && !loading) {
            const nextPage = page + 1;
            setPage(nextPage);
            fetchPosts(nextPage);
        }
    };

    const renderFooter = () => {
        if (!loading) return null;
        return (
            <View style={{ paddingVertical: 20 }}>
                <ActivityIndicator size="small" color={colors.darkPurple} />
            </View>
        );
    };

    return (
        <SafeAreaView
            style={[globalStyles.container, { position: 'relative', paddingVertical: 5 }]}
        >
            <FlatList
                keyExtractor={(item) => item._id}
                data={posts}
                renderItem={({ item }) => <FLVivaClubPostItem item={item} navigation={navigation} />}
                onRefresh={handleRefresh}
                refreshing={refreshing}
                onEndReached={handleLoadMore}
                onEndReachedThreshold={0.5}
                ListFooterComponent={renderFooter}
                showsVerticalScrollIndicator={false}
                ListHeaderComponent={
                    <View style={{ backgroundColor: colors.pageBG, padding: 10, paddingVertical: 8, marginBottom: 10, borderRadius: 8, borderWidth: 1, borderColor: '#eee' }}>
                        <Text style={[globalStyles.fontRegular, { fontSize: 11, color: colors.darkGray, textAlign: 'center' }]}>
                            Posts share personal experiences only. They are not medical advice. For any health concern, please consult a qualified healthcare professional.
                        </Text>
                    </View>
                }
            />

            <LinearGradient
                onTouchEnd={() => navigation.navigate("CreatePost")}
                colors={[colors.darkPurple, colors.purple]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                onMagicTap={() => { }}
                style={{
                    borderRadius: 40,
                    height: 70,
                    width: 70,
                    padding: 2,
                    justifyContent: "center",
                    alignItems: "center",
                    position: "absolute",
                    bottom: 10,
                    right: 10,
                }}
            >
                <MaterialDesignIcons name='pencil-box-outline' color={colors.white} size={22} />
                <Text
                    style={[{
                        fontSize: 10,
                        textAlign: 'center',
                        color: colors.white,
                    }, globalStyles.fontRegular]}
                >
                    Create
                </Text>
            </LinearGradient>
        </SafeAreaView>
    )
}

export default VivaClubPost