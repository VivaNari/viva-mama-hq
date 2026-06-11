import React, { useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, FlatList, Text, TouchableOpacity, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { getUserContents } from '../api/getUserContents'
import { ArticleCard } from '../components/ArticleCard'
import SearchInput from '../components/SearchInput'
import { useAuth } from '../context/AuthContext'
import { globalStyles } from '../public/styles'
import { IUserContent, IUserContentresponse } from '../types/content.types'
import { colors } from '../public/assets/colors'
import { useNavigation, useFocusEffect } from '@react-navigation/native'
import apiClientInterceptor from '../api/apiClientInterceptor'
import { API_VIVA_CLUB_POSTS } from '../constants/endpoints'
import { IVivaClubPost } from '../types/vivaClub.types'
import FLVivaClubPostItem from '../components/vivaClub/FLVivaClubPostItem'
import LinearGradient from 'react-native-linear-gradient'

const ArticleContent = () => {
    const [searchData, setSearchData] = useState<string>("");
    const [userContentsData, setUserContentsData] = useState<IUserContent[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [lastPost, setLastPost] = useState<IVivaClubPost | null>(null);
    const [loadingPost, setLoadingPost] = useState<boolean>(false);

    const navigation = useNavigation<any>();
    const { userId } = useAuth();

    const fetchLastPost = async () => {
        try {
            setLoadingPost(true);
            const { data } = await apiClientInterceptor().get(`${API_VIVA_CLUB_POSTS}?page=1&limit=1`);
            if (data.data.posts && data.data.posts.length > 0) {
                setLastPost(data.data.posts[0]);
            } else {
                setLastPost(null);
            }
        } catch (error) {
            console.error("Error fetching last post:", error);
        } finally {
            setLoadingPost(false);
        }
    };

    useFocusEffect(
        React.useCallback(() => {
            fetchLastPost();
        }, [])
    );

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const getContents: IUserContentresponse = await getUserContents();
                setUserContentsData(getContents.data);
            } catch (error) {
                console.error("Error fetching user contents:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [userId])

    useEffect(() => {
        console.log("searchData", searchData);
    }, [searchData])

    const filteredData = useMemo(() => {
        if (!searchData.trim()) return userContentsData;

        return userContentsData.filter(content => content.featuredTitle.toLowerCase().includes(searchData.toLowerCase()))
    }, [searchData, userContentsData]);

    return (
        <SafeAreaView style={[globalStyles.container]}>
            <FlatList
                data={filteredData.slice(1)}
                keyExtractor={(item) => item._id.toString()}
                renderItem={({ item }) => (
                    <ArticleCard
                        key={item._id.toString()}
                        item={item}

                    />
                )}
                scrollEnabled={true}
                nestedScrollEnabled={false}
                columnWrapperStyle={{
                    justifyContent: 'space-between',
                    alignItems: 'flex-end',
                    paddingBottom: 20
                }}
                numColumns={2}
                ListEmptyComponent={() => (
                    filteredData.length === 0 ? (
                        <View
                            style={{
                                flex: 1,
                                alignItems: 'center',
                                justifyContent: 'center',
                                marginTop: 40,
                            }}
                        >
                            {loading ? (
                                <ActivityIndicator size="large" color={colors.purple} />
                            ) : (
                                <Text style={[{ color: colors.black }, globalStyles.fontRegular]}>
                                    No Contents Found!
                                </Text>
                            )}
                        </View>
                    ) : null
                )}
                ListHeaderComponent={
                    <>
                        {/* Disclaimer */}
                        <View style={{ backgroundColor: colors.pageBG, padding: 10, paddingVertical: 8, marginBottom: 10, borderRadius: 8, borderWidth: 1, borderColor: '#eee' }}>
                            <Text style={[globalStyles.fontRegular, { fontSize: 11, color: colors.darkGray, textAlign: 'center' }]}>
                                This article is for educational purposes only. It is not medical advice. Always consult a qualified healthcare professional for medical advice, diagnosis, or treatment.
                            </Text>
                        </View>

                        {/* Community Section */}
                        <View style={{ marginBottom: 20 }}>
                            <Text style={[globalStyles.fontBold, { fontSize: 18, color: colors.darkPurple, marginBottom: 10 }]}>Community Feed</Text>
                            {loadingPost ? (
                                <ActivityIndicator size="small" color={colors.purple} />
                            ) : lastPost ? (
                                <View>
                                    <FLVivaClubPostItem item={lastPost} navigation={navigation} isFromCommunityScreen={true} />
                                    <TouchableOpacity
                                        onPress={() => navigation.navigate("VivaClub")}
                                        style={{ marginTop: 5, alignSelf: 'flex-end' }}
                                    >
                                        <Text style={[globalStyles.fontSemiBold, { color: colors.darkPurple, textDecorationLine: 'underline' }]}>View All Community Posts</Text>
                                    </TouchableOpacity>
                                </View>
                            ) : (
                                <View style={{ padding: 15, backgroundColor: colors.lightGray, borderRadius: 10, alignItems: 'center' }}>
                                    <Text style={[globalStyles.fontRegular, { color: colors.black, marginBottom: 10 }]}>No community post is available for you</Text>
                                    <LinearGradient
                                        colors={[colors.darkPurple, colors.purple]}
                                        start={{ x: 0, y: 0 }}
                                        end={{ x: 1, y: 0 }}
                                        style={{ borderRadius: 20 }}
                                    >
                                        <TouchableOpacity
                                            onPress={() => navigation.navigate("CreatePost")}
                                            style={{ paddingHorizontal: 20, paddingVertical: 10 }}
                                        >
                                            <Text style={[globalStyles.fontSemiBold, { color: colors.white }]}>Create a Community Post</Text>
                                        </TouchableOpacity>
                                    </LinearGradient>
                                </View>
                            )}
                        </View>

                        {/* Search */}
                        <View style={{}}>
                            <SearchInput setSearchData={setSearchData} marginBottom={5} />
                        </View>
                        <FlatList
                            data={filteredData.slice(0, 1)}
                            keyExtractor={(item) => item._id.toString()}
                            renderItem={({ item }) => (
                                <ArticleCard
                                    key={item._id.toString()}
                                    item={item}
                                    width='full'
                                />
                            )}
                            scrollEnabled={false}
                            nestedScrollEnabled={false}
                        />
                    </>
                }
                ListFooterComponent={
                    <View style={{ backgroundColor: colors.pageBG, padding: 10, paddingVertical: 8, marginTop: 0, marginBottom: 5, borderRadius: 8, borderWidth: 1, borderColor: '#eee' }}>
                        <Text style={[globalStyles.fontRegular, { fontSize: 11, color: colors.darkGray, textAlign: 'center' }]}>
                            If you have any concerns about your health or your baby's health, please consult a qualified healthcare professional. In an emergency, contact your doctor or local emergency services.
                        </Text>
                    </View>
                }
            />
        </SafeAreaView>
    )
}

export default ArticleContent
