import React, { useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, FlatList, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { getUserContents } from '../api/getUserContents'
import { ArticleCard } from '../components/ArticleCard'
import SearchInput from '../components/SearchInput'
import { useAuth } from '../context/AuthContext'
import { globalStyles } from '../public/styles'
import { IUserContent, IUserContentresponse } from '../types/content.types'
import { colors } from '../public/assets/colors'

const ArticleContent = () => {
    const [searchData, setSearchData] = useState<string>("");
    const [userContentsData, setUserContentsData] = useState<IUserContent[]>([]);
    const [loading, setLoading] = useState<boolean>(true);

    const { userId } = useAuth();

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
                )}
                ListHeaderComponent={
                    <>
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

            />
        </SafeAreaView>
    )
}

export default ArticleContent
